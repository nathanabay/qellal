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
import html
import json
import time
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

# Human labels for each reminder stage. Worded to stay accurate for catch-up
# sends too (e.g. reminder_7 also covers a tender first seen at 5 days out).
REMINDER_LABELS = {
    "reminder_7": "closing soon",
    "reminder_3": "closing in a few days",
    "reminder_1": "closes tomorrow",
}

TG_MAX = 3900  # Telegram's hard limit is 4096; leave headroom for the subject.


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
    """A subscription matches a tender if every non-empty criterion matches (AND).
    Category matches ANY of a tender's categories (the many-to-many set), parity
    with the browse/search page."""
    if sub.get("category_id"):
        cat_ids = tender.get("_cat_ids")
        if cat_ids is None:  # not attached (e.g. unit test) — fall back to primary
            pid = tender.get("category_id")
            cat_ids = {pid} if pid is not None else set()
        if sub["category_id"] not in cat_ids:
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


def _subject(kind, items):
    if kind.startswith("reminder"):
        label = REMINDER_LABELS.get(kind, "closing soon")
        if len(items) == 1:
            return f"Tender {label}: {items[0]['title'][:60]}"
        return f"{len(items)} tenders {label}"
    n = len(items)
    return f"{n} new Ethiopian tender{'s' if n != 1 else ''} match your alerts"


def compose(kind, items, unsub_url=None):
    """Plain-text subject + body (used for Telegram and as the email text part)."""
    lines = [
        f"- {t['title']} - deadline {t['deadline']}\n  {APP_URL}/tenders/{t['id']}"
        for t in items
    ]
    body = "\n".join(lines) + f"\n\nManage your alerts: {APP_URL}/account"
    if unsub_url:
        body += f"\nUnsubscribe from emails: {unsub_url}"
    return _subject(kind, items), body


def compose_html(kind, items, unsub_url=None):
    """HTML alternative part for email — table + inline styles so it renders in
    mail clients and reads as a real message (better deliverability than text-only)."""
    heading = html.escape(_subject(kind, items))
    rows = "".join(
        '<tr><td style="padding:10px 0;border-bottom:1px solid #eee">'
        f'<a href="{APP_URL}/tenders/{t["id"]}" '
        'style="color:#1a56db;text-decoration:none;font-weight:600;font-size:15px">'
        f'{html.escape(t["title"])}</a>'
        f'<div style="color:#555;font-size:13px;margin-top:2px">Deadline: {html.escape(str(t["deadline"]))}</div>'
        "</td></tr>"
        for t in items
    )
    footer = f'<a href="{APP_URL}/account" style="color:#888;text-decoration:underline">Manage your alerts</a>'
    if unsub_url:
        footer += f' &middot; <a href="{html.escape(unsub_url)}" style="color:#888;text-decoration:underline">Unsubscribe</a>'
    return (
        '<div style="font-family:system-ui,-apple-system,Arial,sans-serif;'
        'max-width:560px;margin:0 auto;padding:16px;color:#111">'
        f'<h1 style="font-size:18px;margin:0 0 12px">{heading}</h1>'
        f'<table style="width:100%;border-collapse:collapse">{rows}</table>'
        f'<p style="font-size:12px;color:#888;margin-top:24px">{footer}</p>'
        "</div>"
    )


def unsubscribe_url(profile):
    """One-click unsubscribe link for this user's email footer + header."""
    token = profile.get("unsubscribe_token")
    return f"{APP_URL}/api/unsubscribe?token={token}" if token else None


def _build_email(to, subject, body, html_body, unsub_url):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = os.environ.get("SMTP_FROM", os.environ["SMTP_USER"])
    msg["To"] = to
    # RFC 8058 one-click unsubscribe — required by Gmail/Yahoo bulk-sender rules
    # and lets clients show a native "Unsubscribe" button.
    if unsub_url:
        msg["List-Unsubscribe"] = f"<{unsub_url}>"
        msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(body)  # text/plain part (fallback)
    if html_body:
        msg.add_alternative(html_body, subtype="html")  # multipart/alternative
    return msg


def open_smtp():
    """One reusable, logged-in SMTP_SSL connection for the whole batch. Logging in
    once (instead of per message) avoids the burst of logins that most providers
    greylist / rate-limit. Returns a connection the caller must quit()."""
    ctx = ssl.create_default_context()
    s = smtplib.SMTP_SSL(
        os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "465")),
        context=ctx, timeout=30,
    )
    s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
    return s


def send_email(to, subject, body, html_body=None, unsub_url=None, smtp=None):
    msg = _build_email(to, subject, body, html_body, unsub_url)
    if smtp is not None:
        smtp.send_message(msg)  # reuse the batch connection
        return
    # Fallback (no shared connection): open a one-off connection for this message.
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(
        os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "465")),
        context=ctx, timeout=30,
    ) as s:
        s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
        s.send_message(msg)


def _tg_send_one(token, chat_id, text, attempt=0):
    body = urllib.parse.urlencode({
        "chat_id": chat_id, "text": text, "disable_web_page_preview": "true",
    }).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage", data=body, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            r.read()
        return "ok"
    except urllib.error.HTTPError as e:
        if e.code == 429 and attempt < 3:  # rate limited — honor retry_after
            retry = 1
            try:
                retry = int(json.loads(e.read().decode())
                            .get("parameters", {}).get("retry_after", 1))
            except Exception:  # noqa: BLE001
                pass
            time.sleep(retry + 1)
            return _tg_send_one(token, chat_id, text, attempt + 1)
        if e.code == 403:  # the user blocked the bot
            return "blocked"
        raise


def send_telegram(chat_id, text):
    """Send (chunked to Telegram's size limit), pacing ~1 msg/s per chat.
    Returns 'ok' | 'blocked' | (raises on other errors)."""
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    chunks = [text[i:i + TG_MAX] for i in range(0, len(text), TG_MAX)] or [text]
    for chunk in chunks:
        status = _tg_send_one(token, chat_id, chunk)
        if status != "ok":
            return status
        time.sleep(1.1)  # per-chat rate limit is ~1 msg/s
    return "ok"


def _clear_telegram(chat_id):
    """A blocked chat — stop retrying it every day (mirror /stop)."""
    if DRY:
        return
    try:
        rest("profiles", method="PATCH",
             params={"telegram_chat_id": f"eq.{chat_id}"},
             body={"telegram_notifications": False, "telegram_chat_id": None})
    except Exception as e:  # noqa: BLE001
        print(f"  ! clear telegram failed: {e}", file=sys.stderr)


def deliver(profile, channel, kind, items, smtp=None):
    # Telegram has its own /stop unsubscribe; only email needs the footer/header.
    unsub_url = unsubscribe_url(profile) if channel == "email" else None
    subject, body = compose(kind, items, unsub_url)
    if DRY:
        who = profile.get("email") if channel == "email" else profile.get("telegram_chat_id")
        print(f"  -> [{channel}] {who} | {kind} | {subject} | {len(items)} tender(s)")
        return True
    try:
        if channel == "email":
            html_body = compose_html(kind, items, unsub_url)
            send_email(profile["email"], subject, body, html_body, unsub_url, smtp=smtp)
        else:
            status = send_telegram(profile["telegram_chat_id"], f"{subject}\n\n{body}")
            if status == "blocked":
                _clear_telegram(profile["telegram_chat_id"])
                return False
        return True
    except Exception as e:  # noqa: BLE001 - fail one send, not the whole run
        print(f"  ! send failed [{channel}] {kind}: {e}", file=sys.stderr)
        return False


def claim(user_id, tender_id, channel, kind):
    """Reserve a send by inserting its notifications_sent row BEFORE sending
    (code_patterns.md: "insert before counting success"). Returns False if the
    insert fails: the unique constraint makes an already-sent row impossible to
    re-claim (so we never double-send), and a transient failure simply defers the
    send to the next run. The row is rolled back by unclaim() if the send fails."""
    if DRY:
        return True
    try:
        rest("notifications_sent", method="POST", body={
            "user_id": user_id, "tender_id": tender_id,
            "channel": channel, "kind": kind,
        })
        return True
    except Exception as e:  # noqa: BLE001
        print(f"  ! claim failed [{channel}] {kind}: {e}", file=sys.stderr)
        return False


def unclaim(user_id, tender_id, channel, kind):
    """Roll back a claim() after a failed send so the message retries next run."""
    if DRY:
        return
    try:
        rest("notifications_sent", method="DELETE", params={
            "user_id": f"eq.{user_id}", "tender_id": f"eq.{tender_id}",
            "channel": f"eq.{channel}", "kind": f"eq.{kind}",
        })
    except Exception as e:  # noqa: BLE001
        print(f"  ! rollback failed [{channel}] {kind}: {e}", file=sys.stderr)


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
    # Only OPEN tenders (deadline today or later): a closed tender can never fire
    # a reminder (reminder_kind needs days_left >= 1) or a digest (requires
    # deadline >= today), so this cuts the match set from ~all published to just
    # the open ones — the dominant cost of the per-user matching loop.
    tenders = rest("tenders", params={
        "select": "id,title,description,publishing_entity,category_id,region,deadline,source_name,published_at",
        "status": "eq.published",
        "deadline": f"gte.{today.isoformat()}",
    })
    tcats = rest("tender_categories", params={"select": "tender_id,category_id"})
    saved = rest("saved_tenders", params={"select": "user_id,tender_id"})
    # Only the recent dedup window matters: the widest thing we dedup against is a
    # weekly digest (7d) / T-7 reminder, so 35 days is a safe margin. Bounding the
    # read keeps this from paging the ENTIRE (ever-growing) table into memory on
    # every run — the table grows forever, but the hot path stays flat.
    dedup_cutoff = (now - datetime.timedelta(days=35)).isoformat()
    sent = rest("notifications_sent", params={
        "select": "user_id,tender_id,channel,kind",
        "sent_at": f"gte.{dedup_cutoff}",
    })
    sent_set = {(s["user_id"], s["tender_id"], s["channel"], s["kind"]) for s in sent}

    subs_by_user = {}
    for s in subs_all:
        subs_by_user.setdefault(s["user_id"], []).append(s)

    saved_by_user = {}
    for s in saved:
        saved_by_user.setdefault(s["user_id"], set()).add(s["tender_id"])

    tenders_by_id = {t["id"]: t for t in tenders}

    # Category set per tender (many-to-many join + primary) for ANY-match.
    cats_by_tender = {}
    for tc in tcats:
        cats_by_tender.setdefault(tc["tender_id"], set()).add(tc["category_id"])
    for t in tenders:
        ids = set(cats_by_tender.get(t["id"], set()))
        if t.get("category_id") is not None:
            ids.add(t["category_id"])
        t["_cat_ids"] = ids

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
        # tenders. Batched into ONE message per stage per channel (no flooding).
        if p.get("deadline_reminders", True):
            reminder_ids = {t["id"] for t in matched} | saved_ids
            by_kind = {}  # kind -> [tenders]
            for tid in reminder_ids:
                t = tenders_by_id.get(tid)
                if not t:
                    continue
                try:
                    days = (datetime.date.fromisoformat(t["deadline"]) - today).days
                except Exception:  # noqa: BLE001
                    continue
                kind = reminder_kind(days)
                if kind:
                    by_kind.setdefault(kind, []).append(t)
            for kind, tlist in by_kind.items():
                for ch in channels:
                    fresh = [t for t in tlist
                             if (p["id"], t["id"], ch, kind) not in sent_set]
                    if fresh:
                        plan.append((p, ch, kind, fresh))

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
                    # Still-open only: a backfill of old/closed tenders gets a
                    # fresh published_at and would otherwise spam the digest.
                    if _parse_ts(pa) >= cutoff and \
                       datetime.date.fromisoformat(t["deadline"]) >= today:
                        fresh_all.append(t)
                except Exception:  # noqa: BLE001
                    continue
            for ch in channels:
                fresh = [t for t in fresh_all if (p["id"], t["id"], ch, "digest") not in sent_set]
                if fresh:
                    plan.append((p, ch, "digest", fresh))

    # Open ONE SMTP connection for the whole email batch (falls back to
    # per-message connections if this fails). Telegram is unaffected.
    smtp = None
    if not DRY and any(ch == "email" for _, ch, _, _ in plan):
        try:
            smtp = open_smtp()
        except Exception as e:  # noqa: BLE001
            print(f"  ! SMTP connect failed, using per-message connections: {e}",
                  file=sys.stderr)
            smtp = None
    try:
        for p, ch, kind, items in plan:
            # Claim each item (record it) BEFORE sending; if the send fails, roll
            # the claims back so nothing is lost. This makes a double-send
            # impossible (the unique constraint rejects a re-claim) without
            # dropping messages.
            claimed = [t for t in items if claim(p["id"], t["id"], ch, kind)]
            if not claimed:
                continue
            if not deliver(p, ch, kind, claimed, smtp=smtp):
                for t in claimed:
                    unclaim(p["id"], t["id"], ch, kind)
            elif ch == "email" and smtp is not None:
                time.sleep(0.3)  # gentle throttle so bursts don't trip rate limits
    finally:
        if smtp is not None:
            try:
                smtp.quit()
            except Exception:  # noqa: BLE001
                pass

    verb = "DRY-RUN: would send" if DRY else "Sent"
    print(f"{verb} {len(plan)} message(s) across {len(profiles)} profile(s).")


if __name__ == "__main__":
    if not SUPABASE_URL or not SERVICE_KEY:
        # Not configured yet — exit cleanly so the scheduled run doesn't fail-email
        # the owner before secrets are set.
        print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping.")
        sys.exit(0)
    main()
