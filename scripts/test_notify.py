#!/usr/bin/env python3
"""Tests for the notification matcher/sender (scripts/notify.py).

Stdlib unittest only — matches notify.py's no-third-party-deps rule. Run with:
    python -m unittest scripts.test_notify        (from repo root)
    python -m unittest test_notify                (from scripts/)

testing.md calls the notification pipeline "the one thing that must never
silently break" and mandates: matcher unit tests (category/keyword/region/
no-match), an idempotency test (run twice -> second run sends nothing), and an
unsubscribe test.
"""
import os
import sys
import datetime
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import notify  # noqa: E402


def tender(**over):
    base = {
        "id": "t1",
        "title": "Supply of laptops",
        "description": "",
        "publishing_entity": "Ministry of Health",
        "category_id": 5,
        "region": "Addis Ababa",
        "deadline": "2030-01-01",
        "published_at": None,
    }
    base.update(over)
    return base


def sub(**over):
    base = {"id": "s1", "user_id": "u1", "category_id": None, "keyword": None, "region": None}
    base.update(over)
    return base


class KeywordMatching(unittest.TestCase):
    def test_direct_keyword_in_title(self):
        self.assertTrue(notify.keyword_matches("laptops", tender(title="Supply of laptops")))

    def test_synonym_cluster_expands_recall(self):
        # "IT" should catch a "service desk" tender via the synonym cluster.
        t = tender(title="Service desk support contract", description="")
        self.assertTrue(notify.keyword_matches("IT", t))

    def test_word_boundary_avoids_substring_false_positive(self):
        # "it" must not match inside "unit"; nothing else in the text is IT-ish.
        t = tender(title="Procurement unit vacancy", publishing_entity="", description="")
        self.assertFalse(notify.keyword_matches("it", t))

    def test_no_match(self):
        self.assertFalse(notify.keyword_matches("bridge", tender(title="Supply of laptops",
                                                                 publishing_entity="", description="")))


class SubscriptionMatching(unittest.TestCase):
    def test_category_match(self):
        self.assertTrue(notify.matches(sub(category_id=5), tender(category_id=5)))
        self.assertFalse(notify.matches(sub(category_id=9), tender(category_id=5)))

    def test_region_match(self):
        self.assertTrue(notify.matches(sub(region="Addis Ababa"), tender(region="Addis Ababa")))
        self.assertFalse(notify.matches(sub(region="Oromia"), tender(region="Addis Ababa")))

    def test_criteria_are_anded_within_a_subscription(self):
        # category matches but region does not -> whole subscription fails (AND).
        s = sub(category_id=5, region="Oromia")
        self.assertFalse(notify.matches(s, tender(category_id=5, region="Addis Ababa")))

    def test_empty_subscription_never_matches(self):
        self.assertFalse(notify.matches(sub(), tender()))

    def test_user_matches_is_or_across_subscriptions(self):
        subs = [sub(region="Oromia"), sub(keyword="laptops")]
        self.assertTrue(notify.user_matches(subs, tender(region="Addis Ababa", title="Supply of laptops")))


class ReminderStages(unittest.TestCase):
    def test_exact_marks(self):
        self.assertEqual(notify.reminder_kind(7), "reminder_7")
        self.assertEqual(notify.reminder_kind(3), "reminder_3")
        self.assertEqual(notify.reminder_kind(1), "reminder_1")

    def test_catch_up_between_marks(self):
        # A tender caught at 5 days out (7-day run skipped) still gets nudged.
        self.assertEqual(notify.reminder_kind(5), "reminder_7")
        self.assertEqual(notify.reminder_kind(2), "reminder_3")

    def test_too_far_out_and_past_deadline(self):
        self.assertIsNone(notify.reminder_kind(8))
        self.assertIsNone(notify.reminder_kind(0))
        self.assertIsNone(notify.reminder_kind(-3))


class Compose(unittest.TestCase):
    def test_digest_subject_counts_items(self):
        subj, _ = notify.compose("digest", [tender(), tender(id="t2")])
        self.assertIn("2 new", subj)

    def test_email_footer_has_unsubscribe_when_url_given(self):
        _, body = notify.compose("digest", [tender()], "https://x/api/unsubscribe?token=abc")
        self.assertIn("Unsubscribe from emails: https://x/api/unsubscribe?token=abc", body)

    def test_no_unsubscribe_line_without_url(self):
        _, body = notify.compose("digest", [tender()])
        self.assertNotIn("Unsubscribe from emails", body)

    def test_unsubscribe_url_requires_token(self):
        self.assertIsNone(notify.unsubscribe_url({"unsubscribe_token": None}))
        self.assertTrue(notify.unsubscribe_url({"unsubscribe_token": "tok"}).endswith("token=tok"))

    def test_html_has_link_and_escapes_title(self):
        html = notify.compose_html(
            "digest", [tender(id="t9", title="Roads & Bridges <b>")], "https://x/api/unsubscribe?token=z")
        self.assertIn("/tenders/t9", html)
        self.assertIn("Roads &amp; Bridges &lt;b&gt;", html)  # escaped, not raw markup
        self.assertIn("Unsubscribe", html)


class FakeStore:
    """In-memory stand-in for the Supabase REST tables notify.main() reads."""

    def __init__(self, **tables):
        self.tables = {k: [dict(r) for r in v] for k, v in tables.items()}

    def rest(self, path, method="GET", params=None, body=None):
        if method == "GET":
            rows = self.tables.get(path, [])
            if params and params.get("status") == "eq.published":
                rows = [r for r in rows if r.get("status") == "published"]
            return [dict(r) for r in rows]
        if method == "POST":
            self.tables.setdefault(path, []).append(dict(body))
            return [dict(body)]
        if method == "DELETE":
            eqs = {k: v.split("eq.", 1)[1] for k, v in (params or {}).items()}
            self.tables[path] = [
                r for r in self.tables.get(path, [])
                if not all(str(r.get(k)) == v for k, v in eqs.items())
            ]
            return []
        return []


class Idempotency(unittest.TestCase):
    """Running the job twice must never double-send (testing.md hard requirement)."""

    def setUp(self):
        self._saved = {k: getattr(notify, k) for k in ("rest", "send_email", "send_telegram", "DRY")}
        self.sent = []
        notify.send_email = lambda to, subj, body, html=None, unsub=None, smtp=None: self.sent.append(("email", to))
        notify.send_telegram = lambda chat, text: self.sent.append(("telegram", chat))
        notify.DRY = False

    def tearDown(self):
        for k, v in self._saved.items():
            setattr(notify, k, v)

    def _run_with(self, store):
        notify.rest = store.rest
        notify.main()

    def test_second_run_sends_nothing(self):
        recent = (datetime.datetime.now(datetime.timezone.utc)
                  - datetime.timedelta(minutes=5)).isoformat()
        store = FakeStore(
            profiles=[{
                "id": "u1", "email": "u@example.com", "email_notifications": True,
                "telegram_notifications": False, "telegram_chat_id": None,
                "digest_mode": True, "digest_frequency": "daily",
                "deadline_reminders": True, "notifications_paused_until": None,
                "unsubscribe_token": "tok1",
            }],
            subscriptions=[sub(keyword="laptops")],
            tenders=[tender(status="published", published_at=recent, deadline="2030-01-01")],
            saved_tenders=[],
            notifications_sent=[],
        )
        self._run_with(store)
        first = list(self.sent)
        self.assertEqual(len(first), 1, "first run should send exactly one digest email")

        self.sent.clear()
        self._run_with(store)  # same store, now carries notifications_sent rows
        self.assertEqual(self.sent, [], "second run must send nothing (dedup)")


class Rollback(unittest.TestCase):
    """A failed send must roll back its claim so the message is retried, never lost."""

    def setUp(self):
        self._saved = {k: getattr(notify, k) for k in ("rest", "send_email", "send_telegram", "DRY")}
        notify.send_telegram = lambda chat, text: None
        notify.DRY = False

    def tearDown(self):
        for k, v in self._saved.items():
            setattr(notify, k, v)

    def _store(self):
        recent = (datetime.datetime.now(datetime.timezone.utc)
                  - datetime.timedelta(minutes=5)).isoformat()
        return FakeStore(
            profiles=[{
                "id": "u1", "email": "u@example.com", "email_notifications": True,
                "telegram_notifications": False, "telegram_chat_id": None,
                "digest_mode": True, "digest_frequency": "daily",
                "deadline_reminders": False, "notifications_paused_until": None,
                "unsubscribe_token": "tok1",
            }],
            subscriptions=[sub(keyword="laptops")],
            tenders=[tender(status="published", published_at=recent, deadline="2030-01-01")],
            saved_tenders=[],
            notifications_sent=[],
        )

    def test_failed_send_rolls_back_and_retries(self):
        store = self._store()
        notify.rest = store.rest

        def boom(*a, **k):
            raise RuntimeError("smtp down")

        notify.send_email = boom
        notify.main()  # send fails
        self.assertEqual(store.tables["notifications_sent"], [],
                         "claim must be rolled back when the send fails")

        sent = []
        notify.send_email = lambda to, subj, body, html=None, unsub=None, smtp=None: sent.append(to)
        notify.main()  # retry succeeds
        self.assertEqual(sent, ["u@example.com"])
        self.assertEqual(len(store.tables["notifications_sent"]), 1, "claim persists once sent")


class DigestWindow(unittest.TestCase):
    def setUp(self):
        self._saved = {k: getattr(notify, k) for k in ("rest", "send_email", "send_telegram", "DRY")}
        self.sent = []
        notify.send_email = lambda to, subj, body, html=None, unsub=None, smtp=None: self.sent.append(("email", to))
        notify.send_telegram = lambda chat, text: self.sent.append(("telegram", chat))
        notify.DRY = False

    def tearDown(self):
        for k, v in self._saved.items():
            setattr(notify, k, v)

    def _profile(self):
        return {
            "id": "u1", "email": "u@example.com", "email_notifications": True,
            "telegram_notifications": False, "telegram_chat_id": None,
            "digest_mode": True, "digest_frequency": "daily",
            "deadline_reminders": False, "notifications_paused_until": None,
            "unsubscribe_token": "tok1",
        }

    def test_null_published_at_is_excluded_from_digest(self):
        store = FakeStore(
            profiles=[self._profile()],
            subscriptions=[sub(keyword="laptops")],
            tenders=[tender(status="published", published_at=None, deadline="2030-01-01")],
            saved_tenders=[],
            notifications_sent=[],
        )
        notify.rest = store.rest
        notify.main()
        self.assertEqual(self.sent, [], "a tender with no published_at must not appear in the digest")

    def test_recent_published_at_is_included(self):
        recent = (datetime.datetime.now(datetime.timezone.utc)
                  - datetime.timedelta(hours=1)).isoformat()
        store = FakeStore(
            profiles=[self._profile()],
            subscriptions=[sub(keyword="laptops")],
            tenders=[tender(status="published", published_at=recent, deadline="2030-01-01")],
            saved_tenders=[],
            notifications_sent=[],
        )
        notify.rest = store.rest
        notify.main()
        self.assertEqual(len(self.sent), 1)


if __name__ == "__main__":
    unittest.main()
