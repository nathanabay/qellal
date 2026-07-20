-- 0026: opaque per-user token for one-click email unsubscribe.
--
-- The PRD requires "pause/unsubscribe in one click" and REVIEW-CHECKLIST names
-- the email unsubscribe link explicitly, but digest/reminder emails only linked
-- to /account (which requires logging in). This adds a secret token — same shape
-- as telegram_link_token (0005) — that the notification job embeds in an
-- unsubscribe URL and the /api/unsubscribe route resolves without a session.
alter table profiles
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_unsubscribe_token_idx
  on profiles (unsubscribe_token);
