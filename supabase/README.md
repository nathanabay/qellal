# Supabase setup — Qellal

The database schema lives in `migrations/` as plain SQL. We run them by hand in
the Supabase SQL editor (no Supabase CLI = one less dependency during MVP).

## One-time setup

1. **Create the project**
   - Go to https://supabase.com → New project
   - **Region: EU (Frankfurt)** — closest to Ethiopia, matches our data-residency choice
   - Save the database password somewhere safe

2. **Run the migrations in order** (Project → SQL Editor → New query → paste → Run):
   1. `migrations/0001_schema.sql` — tables + indexes
   2. `migrations/0002_functions_triggers.sql` — role helper + auto-create-profile trigger
   3. `migrations/0003_rls.sql` — enable RLS + policies
   4. `migrations/0004_seed.sql` — **dev only**: 10 categories + 20 fake tenders

   Order matters: 0003's policies depend on the `current_user_role()` function from 0002.
   `0004_seed.sql` is safe to re-run (it wipes prior `created_by='seed'` rows first) and
   is only for local development — delete those rows before going live.

3. **Copy the keys into `.env.local`** (Project → Settings → API):
   ```
   NEXT_PUBLIC_SUPABASE_URL=       # Project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=  # anon / public key
   SUPABASE_SERVICE_ROLE_KEY=      # service_role key — SERVER ONLY, never in browser
   ```

## Verifying RLS (do this before trusting it)

- **As anonymous** (SQL editor runs as service role, so test via the app or the
  API with the anon key): selecting `tenders` should return only `status='published'` rows.
- **As a normal user**: they can read/update only their own `profiles` row and
  only their own `subscriptions`.
- Staff/admin: set a user's `role` to `'staff'` manually
  (`update profiles set role='staff' where id='<uuid>';`) and confirm they can see
  `pending_review` tenders.

## Auth email configuration (required for confirm + reset links to work)

The app uses the server-side `token_hash` flow, so the emails must point at our
`/auth/confirm` route. In the Supabase Dashboard:

**Authentication → URL Configuration**
- **Site URL:** `http://localhost:3000` (swap for the real domain at launch)
- **Redirect URLs:** add `http://localhost:3000/**`

**Authentication → Email Templates** — replace the link in each:
- *Confirm signup:*
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/tenders`
- *Reset password:*
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password`

**Authentication → Providers → Email:** keep **Confirm email** ON (we require it).
Note: the free built-in email sender is rate-limited (~a few/hour) — fine for
testing, but wire a real SMTP/Resend sender before launch.

## Changing the schema later

Add a new numbered file (`0004_*.sql`) — never edit an already-applied migration.
State the rollback in the file header (per AGENTS.md rule).
