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
import re
import sys
import ssl
import json
import smtplib
import datetime
import functools
import urllib.error
import urllib.request
import urllib.parse
from email.message import EmailMessage

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
APP_URL = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")
DRY = os.environ.get("DRY_RUN") == "1"

# Reminder stages, most-urgent first. A tender that is `days_left` days from its
# deadline maps to the tightest stage it has reached (days_left <= threshold), NOT
# an exact-day hit. This keeps reminders catch-up-safe: a skipped cron run or a
# tender scraped only a few days before its deadline still gets nudged instead of
# silently falling between the 7/3/1 marks. Per-stage dedup (notifications_sent)
# stops repeats, so each stage is sent at most once.
REMINDER_STAGES = [(1, "reminder_1"), (3, "reminder_3"), (7, "reminder_7")]


def reminder_kind(days_left):
    """The reminder stage due `days_left` days before the deadline, or None.

    Only fires while days_left >= 1 (deadline day / past is left to the digest and
    listings), which also keeps the stage labels accurate:
      1 day  -> reminder_1 ("closes tomorrow")
      2-3    -> reminder_3
      4-7    -> reminder_7
    """
    if days_left < 1:
        return None
    for threshold, kind in REMINDER_STAGES:
        if days_left <= threshold:
            return kind
    return None

# Sector synonym clusters — a keyword also matches any sibling term in a cluster
# it belongs to, so "IT support" catches "service desk" and "construction"
# catches "civil works" (report §2.5: exact-keyword alerts miss real matches).
# Deliberately domain-specific; generic verbs like "supply" are left out so we
# widen recall without flooding.
SYNONYM_CLUSTERS = [
    {"it", "ict", "information technology", "software", "computer",
     "it support", "help desk", "service desk", "networking"},
    {"construction", "building", "civil works", "contractor", "renovation",
     "road", "bridge", "infrastructure"},
    {"vehicle", "car", "truck", "automobile", "fleet", "spare parts"},
    {"medical", "medicine", "pharmaceutical", "drugs", "hospital",
     "clinical", "laboratory", "diagnostic"},
    {"consultancy", "consulting", "consultant", "advisory",
     "technical assistance", "feasibility study"},
    {"security", "guard", "surveillance", "cctv"},
    {"furniture", "office equipment", "stationery"},
    {"training", "capacity building", "workshop", "seminar"},
    {"cleaning", "sanitation", "janitorial", "hygiene"},
    {"electrical", "electricity", "power", "generator", "solar"},
    {"water", "borehole", "irrigation", "wash", "plumbing"},
    {"catering", "food", "nutrition"},
    {"transport", "logistics", "freight", "shipping", "courier"},
    {"printing", "publishing", "graphic design"},
    {"insurance", "audit", "accounting", "financial services"},
]

_TAG_RE = re.compile(r"<[^>]+>")


def _expand(keyword):
    """The keyword plus every term in any cluster it (or a word of it) belongs to."""
    kw = keyword.lower().strip()
    words = set(kw.split())
    terms = {kw}
    for cluster in SYNONYM_CLUSTERS:
        if kw in cluster or words & cluster:
            terms |= cluster
    return terms


@functools.lru_cache(maxsize=512)
def _pattern_for(keyword):
    # Longest-first, word-boundary alternation so short terms ("it", "car")
    # don't match inside larger words ("unit", "scar").
    terms = sorted(_expand(keyword), key=len, reverse=True)
    return re.compile(r"\b(" + "|".join(re.escape(t) for t in terms) + r")\b", re.I)


def keyword_matches(keyword, tender):
    """True if the keyword (or a synonym) appears in the title, buyer, or body."""
    title = tender.get("title") or ""
    entity = tender.get("publishing_entity") or ""
    desc = _TAG_RE.sub(" ", tender.get("description") or "")
    return bool(_pattern_for(keyword).search(f"{title} {entity} {desc}"))


PAGE_SIZE = 1000  # PostgREST returns at most this many rows per request by default


def _req(url, method, data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", SERVICE_KEY)
    req.add_header("Authorization", f"Bearer {SERVICE_KEY}")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    return req


def _range_total(content_range):
    """Total row count from a PostgREST Content-Range (e.g. 'items 0-999/2456')."""
    if not content_range or "/" not in content_range:
        return None
    total = content_range.rsplit("/", 1)[1].strip()
    return int(total) if total.isdigit() else None


def rest(path, method="GET", params=None, body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)

    if method != "GET":
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Prefer": "return=representation"} if method in ("POST", "PATCH") else None
        with urllib.request.urlopen(_req(url, method, data, headers), timeout=30) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else []

    # GET: page through the whole result set. PostgREST caps a single response at
    # a max-rows limit, so reading a table in one shot silently truncates once it
    # grows past that cap — and a truncated notifications_sent read would break
    # dedup and double-send. Advance by the rows actually returned (not by
    # PAGE_SIZE) so this is correct whatever the server's real cap is.
    rows = []
    offset = 0
    for _ in range(10_000):  # safety bound against a misbehaving server
        headers = {"Range-Unit": "items", "Range": f"{offset}-{offset + PAGE_SIZE - 1}"}
        try:
            with urllib.request.urlopen(_req(url, "GET", None, headers), timeout=30) as r:
                txt = r.read().decode()
                page = json.loads(txt) if txt else []
                total = _range_total(r.headers.get("Content-Range"))
        except urllib.error.HTTPError as e:
            if e.code == 416:  # requested range past the end — nothing left
                break
            raise
        if not page:
            break
        rows.extend(page)
        offset += len(page)
        if total is not None and offset >= total:
            break
    return rows


def matches(sub, tender):
    """A subscription matches a tender if every non-empty criterion matches (AND)."""
    if sub.get("category_id") and sub["category_id"] != tender.get("category_id"):
        return False
    if sub.get("region") and sub["region"] != tender.get("region"):
        return False
    if sub.get("keyword") and not keyword_matches(sub["keyword"], tender):
        return False
    # Must have at least one real criterion (enforced at creation; guard anyway).
    return any([sub.get("category_id"), sub.get("region"), sub.get("keyword")])


def user_matches(subs, tender):
    """A tender matches a user if it matches ANY of their subscriptions (OR)."""
    return any(matches(s, tender) for s in subs)


def compose(kind, items, unsub_url=None):
    labels = {
        "reminder_7": "closing soon",
        "reminder_3": "closing in a few days",
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
    if unsub_url:
        body += f"\nUnsubscribe from emails: {unsub_url}"
    return subject, body


def unsubscribe_url(profile):
    """One-click unsubscribe link for this user's email footer + header."""
    token = profile.get("unsubscribe_token")
    return f"{APP_URL}/api/unsubscribe?token={token}" if token else None


def send_email(to, subject, body, unsub_url=None):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = os.environ.get("SMTP_FROM", os.environ["SMTP_USER"])
    msg["To"] = to
    # RFC 8058 one-click unsubscribe — required by Gmail/Yahoo bulk-sender rules
    # and lets clients show a native "Unsubscribe" button.
    if unsub_url:
        msg["List-Unsubscribe"] = f"<{unsub_url}>"
        msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
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
    # Telegram has its own /stop unsubscribe; only email needs the footer/header.
    unsub_url = unsubscribe_url(profile) if channel == "email" else None
    subject, body = compose(kind, items, unsub_url)
    if DRY:
        who = profile.get("email") if channel == "email" else profile.get("telegram_chat_id")
        print(f"  -> [{channel}] {who} | {kind} | {subject} | {len(items)} tender(s)")
        return True
    try:
        if channel == "email":
            send_email(profile["email"], subject, body, unsub_url)
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
                  "telegram_chat_id,digest_mode,digest_frequency,deadline_reminders,"
                  "notifications_paused_until,unsubscribe_token",
    })
    subs_all = rest("subscriptions", params={
        "select": "id,user_id,category_id,keyword,region",
    })
    tenders = rest("tenders", params={
        "select": "id,title,description,publishing_entity,category_id,region,deadline,source_name,published_at",
        "status": "eq.published",
    })
    saved = rest("saved_tenders", params={"select": "user_id,tender_id"})
    sent = rest("notifications_sent", params={"select": "user_id,tender_id,channel,kind"})
    sent_set = {(s["user_id"], s["tender_id"], s["channel"], s["kind"]) for s in sent}

    subs_by_user = {}
    for s in subs_all:
        subs_by_user.setdefault(s["user_id"], []).append(s)

    saved_by_user = {}
    for s in saved:
        saved_by_user.setdefault(s["user_id"], set()).add(s["tender_id"])

    tenders_by_id = {t["id"]: t for t in tenders}

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
        saved_ids = saved_by_user.get(p["id"], set())
        if not usubs and not saved_ids:
            continue

        channels = []
        if p.get("email_notifications") and p.get("email"):
            channels.append("email")
        if p.get("telegram_notifications") and p.get("telegram_chat_id"):
            channels.append("telegram")
        if not channels:
            continue

        matched = [t for t in tenders if user_matches(usubs, t)] if usubs else []

        # Reminders (time-sensitive): subscription matches + individually saved
        # tenders (per-tender "remind me"). One message per tender per stage.
        if p.get("deadline_reminders", True):
            reminder_ids = {t["id"] for t in matched} | saved_ids
            for tid in reminder_ids:
                t = tenders_by_id.get(tid)
                if not t:
                    continue
                try:
                    days = (datetime.date.fromisoformat(t["deadline"]) - today).days
                except Exception:  # noqa: BLE001
                    continue
                kind = reminder_kind(days)
                if not kind:
                    continue
                for ch in channels:
                    if (p["id"], t["id"], ch, kind) not in sent_set:
                        plan.append((p, ch, kind, [t]))

        # Digest: newly published matching items, grouped into one message.
        # Cadence per user: 'daily' (24h window, every run) or 'weekly' (7-day
        # window, sent only on Mondays). 'off' skips new-tender alerts entirely.
        freq = p.get("digest_frequency") or ("daily" if p.get("digest_mode", True) else "off")
        window_hours = 24 if freq == "daily" else 24 * 7 if freq == "weekly" else 0
        weekly_due = freq != "weekly" or today.weekday() == 0  # Monday == 0
        if matched and window_hours and weekly_due:
            cutoff = now - datetime.timedelta(hours=window_hours)
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
