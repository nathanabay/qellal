#!/usr/bin/env python3
"""Qellal daily notification matcher (runs on GitHub Actions cron).

Matches published tenders to user subscriptions and sends:
  - Deadline REMINDERS at T-7 / T-3 / T-1 days, batched per stage (F4/F9).
  - A DIGEST of newly published matching OPEN tenders, daily or weekly (F5).

Channels: email (SMTP) + Telegram only (no SMS, F2). Precision-matched to each
user's saved subscriptions (F6, category = ANY of a tender's categories). Respects
a pause window (F7). Idempotent via notifications_sent (user_id, tender_id,
channel, kind). Set DRY_RUN=1 to print what would be sent without sending or
recording anything.

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
import time
import smtplib
import datetime
import functools
import urllib.request
import urllib.parse
import urllib.error
from email.message import EmailMessage

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
APP_URL = os.environ.get("APP_URL", "http://localhost:3000").rstrip("/")
DRY = os.environ.get("DRY_RUN") == "1"

REMINDER_DAYS = {7: "reminder_7", 3: "reminder_3", 1: "reminder_1"}
TG_MAX = 3900  # Telegram hard limit is 4096; leave headroom for the subject.

# Sector synonym clusters — a keyword also matches any sibling term in a cluster
# it belongs to, so "IT support" catches "service desk" and "construction"
# catches "civil works" (report §2.5: exact-keyword alerts miss real matches).
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


# --- Supabase REST ---------------------------------------------------------

def _request(url, method="GET", body=None, extra_headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", SERVICE_KEY)
    req.add_header("Authorization", f"Bearer {SERVICE_KEY}")
    req.add_header("Content-Type", "application/json")
    if method in ("POST", "PATCH"):
        req.add_header("Prefer", "return=representation")
    for k, v in (extra_headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=30) as r:
        txt = r.read().decode()
        return json.loads(txt) if txt else []


def rest(path, method="GET", params=None, body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    return _request(url, method=method, body=body)


def get_all(path, params=None):
    """Paginated GET — PostgREST caps each response at 1000 rows, so page through
    with Range headers until a short page. Without this the matcher would silently
    process only the first 1000 tenders / dedup records."""
    out = []
    page = 1000
    frm = 0
    while True:
        url = f"{SUPABASE_URL}/rest/v1/{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        batch = _request(url, extra_headers={
            "Range-Unit": "items",
            "Range": f"{frm}-{frm + page - 1}",
        })
        out.extend(batch)
        if len(batch) < page:
            break
        frm += page
    return out


# --- Matching --------------------------------------------------------------

def matches(sub, tender):
    """A subscription matches a tender if every non-empty criterion matches (AND).
    Category matches ANY of a tender's categories (the many-to-many set), parity
    with the browse page."""
    if sub.get("category_id") and sub["category_id"] not in tender.get("_cat_ids", set()):
        return False
    if sub.get("region") and sub["region"] != tender.get("region"):
        return False
    if sub.get("keyword") and not keyword_matches(sub["keyword"], tender):
        return False
    return any([sub.get("category_id"), sub.get("region"), sub.get("keyword")])


def user_matches(subs, tender):
    return any(matches(s, tender) for s in subs)


# --- Composition -----------------------------------------------------------

def compose(kind, items):
    labels = {
        "reminder_7": ("closes in 7 days", "closing in 7 days"),
        "reminder_3": ("closes in 3 days", "closing in 3 days"),
        "reminder_1": ("closes tomorrow", "closing tomorrow"),
    }
    lines = [
        f"- {t['title']} - deadline {t['deadline']}\n  {APP_URL}/tenders/{t['id']}"
        for t in items
    ]
    if kind.startswith("reminder"):
        singular, plural = labels.get(kind, ("closing soon", "closing soon"))
        subject = (
            f"Tender {singular}: {items[0]['title'][:60]}"
            if len(items) == 1
            else f"{len(items)} tenders {plural}"
        )
    else:
        n = len(items)
        subject = f"{n} new Ethiopian tender{'s' if n != 1 else ''} match your alerts"
    body = "\n".join(lines) + f"\n\nManage your alerts: {APP_URL}/account"
    return subject, body


# --- Delivery: email -------------------------------------------------------

_smtp = None


def _get_smtp():
    """One reused SMTP connection per run (reconnect on drop)."""
    global _smtp
    if _smtp is None:
        ctx = ssl.create_default_context()
        _smtp = smtplib.SMTP_SSL(
            os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "465")),
            context=ctx, timeout=30,
        )
        _smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
    return _smtp


def send_email(to, subject, body):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = os.environ.get("SMTP_FROM", os.environ["SMTP_USER"])
    msg["To"] = to
    # Give mail clients an unsubscribe affordance (deliverability + fewer
    # spam complaints); points at the account page where alerts are managed.
    msg["List-Unsubscribe"] = f"<{APP_URL}/account>"
    msg.set_content(body)
    try:
        _get_smtp().send_message(msg)
    except smtplib.SMTPServerDisconnected:
        global _smtp
        _smtp = None  # stale connection — reconnect once
        _get_smtp().send_message(msg)


# --- Delivery: Telegram (rate limits, 429 backoff, 403 = blocked) ----------

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
        if e.code == 429 and attempt < 3:
            retry = 1
            try:
                payload = json.loads(e.read().decode())
                retry = int(payload.get("parameters", {}).get("retry_after", 1))
            except Exception:  # noqa: BLE001
                pass
            time.sleep(retry + 1)
            return _tg_send_one(token, chat_id, text, attempt + 1)
        if e.code == 403:  # user blocked the bot
            return "blocked"
        raise


def send_telegram(chat_id, text):
    """Send (chunked to Telegram's size limit), pacing ~1 msg/s per chat."""
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


def deliver(profile, channel, kind, items):
    """Returns 'ok' | 'blocked' | 'failed'."""
    subject, body = compose(kind, items)
    if DRY:
        who = profile.get("email") if channel == "email" else profile.get("telegram_chat_id")
        print(f"  -> [{channel}] {who} | {kind} | {subject} | {len(items)} tender(s)")
        return "ok"
    try:
        if channel == "email":
            send_email(profile["email"], subject, body)
            return "ok"
        status = send_telegram(profile["telegram_chat_id"], f"{subject}\n\n{body}")
        if status == "blocked":
            _clear_telegram(profile["telegram_chat_id"])
        return status
    except Exception as e:  # noqa: BLE001 - fail one send, not the whole run
        print(f"  ! send failed [{channel}] {kind}: {e}", file=sys.stderr)
        return "failed"


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


# --- Main ------------------------------------------------------------------

PROFILE_COLS = (
    "id,email,email_notifications,telegram_notifications,telegram_chat_id,"
    "digest_mode,deadline_reminders,notifications_paused_until"
)


def fetch_profiles():
    """Prefer the new digest_frequency column; fall back if the migration (0021)
    isn't applied yet so the whole job doesn't 400 on a missing column."""
    try:
        return get_all("profiles", {"select": PROFILE_COLS + ",digest_frequency"})
    except urllib.error.HTTPError as e:
        if e.code == 400:
            print("  (digest_frequency column absent — using digest_mode; apply migration 0021)",
                  file=sys.stderr)
            return get_all("profiles", {"select": PROFILE_COLS})
        raise


def main():
    today = datetime.date.today()  # GitHub Actions runs in UTC
    now = datetime.datetime.now(datetime.timezone.utc)

    profiles = fetch_profiles()
    subs_all = get_all("subscriptions", {"select": "id,user_id,category_id,keyword,region"})
    tenders = get_all("tenders", {
        "select": "id,title,description,publishing_entity,category_id,region,deadline,source_name,published_at",
        "status": "eq.published",
    })
    tcats = get_all("tender_categories", {"select": "tender_id,category_id"})
    saved = get_all("saved_tenders", {"select": "user_id,tender_id"})
    sent = get_all("notifications_sent", {"select": "user_id,tender_id,channel,kind"})
    sent_set = {(s["user_id"], s["tender_id"], s["channel"], s["kind"]) for s in sent}

    # Category set per tender (many-to-many join + primary) for ANY-match.
    cats_by_tender = {}
    for tc in tcats:
        cats_by_tender.setdefault(tc["tender_id"], set()).add(tc["category_id"])
    for t in tenders:
        ids = set(cats_by_tender.get(t["id"], set()))
        if t.get("category_id") is not None:
            ids.add(t["category_id"])
        t["_cat_ids"] = ids

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
                kind = REMINDER_DAYS.get(days)
                if kind:
                    by_kind.setdefault(kind, []).append(t)
            for kind, tlist in by_kind.items():
                for ch in channels:
                    fresh = [t for t in tlist
                             if (p["id"], t["id"], ch, kind) not in sent_set]
                    if fresh:
                        plan.append((p, ch, kind, fresh))

        # Digest: newly published, still-OPEN matching items, grouped into one
        # message. Cadence: 'daily' (24h window) or 'weekly' (7-day window, only
        # on Mondays). 'off' skips. Requires deadline in the future so a backfill
        # of old/closed tenders (which get a fresh published_at) can't spam.
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
                    if _parse_ts(pa) >= cutoff and \
                       datetime.date.fromisoformat(t["deadline"]) >= today:
                        fresh_all.append(t)
                except Exception:  # noqa: BLE001
                    continue
            for ch in channels:
                fresh = [t for t in fresh_all
                         if (p["id"], t["id"], ch, "digest") not in sent_set]
                if fresh:
                    plan.append((p, ch, "digest", fresh))

    sent_count = 0
    for p, ch, kind, items in plan:
        status = deliver(p, ch, kind, items)
        if status == "ok":
            sent_count += 1
            for t in items:
                record(p["id"], t["id"], ch, kind)
        # 'blocked'/'failed' → don't record, so it's retried (or the chat is
        # cleared) next run.

    if _smtp is not None:
        try:
            _smtp.quit()
        except Exception:  # noqa: BLE001
            pass

    verb = "DRY-RUN: would send" if DRY else "Sent"
    print(f"{verb} {sent_count}/{len(plan)} message(s) across {len(profiles)} profile(s).")


if __name__ == "__main__":
    if not SUPABASE_URL or not SERVICE_KEY:
        # Not configured yet — exit cleanly so the scheduled run doesn't fail-email
        # the owner before secrets are set.
        print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping.")
        sys.exit(0)
    main()
