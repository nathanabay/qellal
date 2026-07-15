#!/usr/bin/env python3
"""Qellal daily notification matcher (runs on GitHub Actions cron).

Matches published tenders to user subscriptions and sends:
  - Deadline REMINDERS at T-7 / T-3 / T-1 days (the time-sensitive path, F4/F9).
  - A daily DIGEST of newly published matching tenders (low-noise default, F5).

Channels: email (SMTP) + Telegram only (no SMS, F2). Precision-matched to each
user's saved subscriptions (F6). Respects a pause window (F7). Idempotent via
notifications_sent (user_id, tender_id, channel, kind). Set DRY_RUN=1 to print
what would be sent without sending or recording anything.

Stdlib only — no third-party deps.

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL,
     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM,
     TELEGRAM_BOT_TOKEN, DRY_RUN
"""
import os
import sys
import ssl
import json
import smtplib
import datetime
import urllib.request
import urllib.parse
from email.message import EmailMessage

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
APP_URL = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")
DRY = os.environ.get("DRY_RUN") == "1"

REMINDER_DAYS = {7: "reminder_7", 3: "reminder_3", 1: "reminder_1"}


def rest(path, method="GET", params=None, body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", SERVICE_KEY)
    req.add_header("Authorization", f"Bearer {SERVICE_KEY}")
    req.add_header("Content-Type", "application/json")
    if method in ("POST", "PATCH"):
        req.add_header("Prefer", "return=representation")
    with urllib.request.urlopen(req, timeout=30) as r:
        txt = r.read().decode()
        return json.loads(txt) if txt else []


def matches(sub, tender):
    """A subscription matches a tender if every non-empty criterion matches (AND)."""
    if sub.get("category_id") and sub["category_id"] != tender.get("category_id"):
        return False
    if sub.get("region") and sub["region"] != tender.get("region"):
        return False
    if sub.get("keyword") and sub["keyword"].lower() not in (tender.get("title") or "").lower():
        return False
    # Must have at least one real criterion (enforced at creation; guard anyway).
    return any([sub.get("category_id"), sub.get("region"), sub.get("keyword")])


def user_matches(subs, tender):
    """A tender matches a user if it matches ANY of their subscriptions (OR)."""
    return any(matches(s, tender) for s in subs)


def compose(kind, items):
    labels = {
        "reminder_7": "closes in 7 days",
        "reminder_3": "closes in 3 days",
        "reminder_1": "closes tomorrow",
    }
    lines = [
        f"- {t['title']} - deadline {t['deadline']}\n  {APP_URL}/tenders/{t['id']}"
        for t in items
    ]
    if kind.startswith("reminder"):
        subject = f"Tender {labels.get(kind, 'closing soon')}: {items[0]['title'][:60]}"
    else:
        n = len(items)
        subject = f"{n} new Ethiopian tender{'s' if n != 1 else ''} match your alerts"
    body = "\n".join(lines) + f"\n\nManage your alerts: {APP_URL}/account"
    return subject, body


def send_email(to, subject, body):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = os.environ.get("SMTP_FROM", os.environ["SMTP_USER"])
    msg["To"] = to
    msg.set_content(body)
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(
        os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "465")),
        context=ctx, timeout=30,
    ) as s:
        s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
        s.send_message(msg)


def send_telegram(chat_id, text):
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    body = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": "true",
    }).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage", data=body, method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        r.read()


def deliver(profile, channel, kind, items):
    subject, body = compose(kind, items)
    if DRY:
        who = profile.get("email") if channel == "email" else profile.get("telegram_chat_id")
        print(f"  -> [{channel}] {who} | {kind} | {subject} | {len(items)} tender(s)")
        return True
    try:
        if channel == "email":
            send_email(profile["email"], subject, body)
        else:
            send_telegram(profile["telegram_chat_id"], f"{subject}\n\n{body}")
        return True
    except Exception as e:  # noqa: BLE001 - fail one send, not the whole run
        print(f"  ! send failed [{channel}] {kind}: {e}", file=sys.stderr)
        return False


def record(user_id, tender_id, channel, kind):
    if DRY:
        return
    try:
        rest("notifications_sent", method="POST", body={
            "user_id": user_id, "tender_id": tender_id,
            "channel": channel, "kind": kind,
        })
    except Exception as e:  # noqa: BLE001
        print(f"  ! record failed: {e}", file=sys.stderr)


def _parse_ts(value):
    return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))


def main():
    today = datetime.date.today()  # GitHub Actions runs in UTC
    now = datetime.datetime.now(datetime.timezone.utc)

    profiles = rest("profiles", params={
        "select": "id,email,email_notifications,telegram_notifications,"
                  "telegram_chat_id,digest_mode,notifications_paused_until",
    })
    subs_all = rest("subscriptions", params={
        "select": "id,user_id,category_id,keyword,region",
    })
    tenders = rest("tenders", params={
        "select": "id,title,category_id,region,deadline,source_name,published_at",
        "status": "eq.published",
    })
    sent = rest("notifications_sent", params={"select": "user_id,tender_id,channel,kind"})
    sent_set = {(s["user_id"], s["tender_id"], s["channel"], s["kind"]) for s in sent}

    subs_by_user = {}
    for s in subs_all:
        subs_by_user.setdefault(s["user_id"], []).append(s)

    plan = []  # (profile, channel, kind, [tenders])

    for p in profiles:
        paused = p.get("notifications_paused_until")
        if paused:
            try:
                if _parse_ts(paused) > now:
                    continue
            except Exception:  # noqa: BLE001
                pass

        usubs = subs_by_user.get(p["id"], [])
        if not usubs:
            continue

        channels = []
        if p.get("email_notifications") and p.get("email"):
            channels.append("email")
        if p.get("telegram_notifications") and p.get("telegram_chat_id"):
            channels.append("telegram")
        if not channels:
            continue

        matched = [t for t in tenders if user_matches(usubs, t)]

        # Reminders (time-sensitive): one message per tender per stage.
        for t in matched:
            try:
                days = (datetime.date.fromisoformat(t["deadline"]) - today).days
            except Exception:  # noqa: BLE001
                continue
            kind = REMINDER_DAYS.get(days)
            if not kind:
                continue
            for ch in channels:
                if (p["id"], t["id"], ch, kind) not in sent_set:
                    plan.append((p, ch, kind, [t]))

        # Digest: newly published (last 24h) matching items, grouped into one message.
        if p.get("digest_mode", True):
            cutoff = now - datetime.timedelta(hours=24)
            fresh_all = []
            for t in matched:
                pa = t.get("published_at")
                if not pa:
                    continue
                try:
                    if _parse_ts(pa) >= cutoff:
                        fresh_all.append(t)
                except Exception:  # noqa: BLE001
                    continue
            for ch in channels:
                fresh = [t for t in fresh_all if (p["id"], t["id"], ch, "digest") not in sent_set]
                if fresh:
                    plan.append((p, ch, "digest", fresh))

    for p, ch, kind, items in plan:
        if deliver(p, ch, kind, items):
            for t in items:
                record(p["id"], t["id"], ch, kind)

    verb = "DRY-RUN: would send" if DRY else "Sent"
    print(f"{verb} {len(plan)} message(s) across {len(profiles)} profile(s).")


if __name__ == "__main__":
    if not SUPABASE_URL or not SERVICE_KEY:
        # Not configured yet — exit cleanly so the scheduled run doesn't fail-email
        # the owner before secrets are set.
        print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping.")
        sys.exit(0)
    main()
