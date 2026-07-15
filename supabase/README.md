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

   Order matters: 0003's policies depend on the `current_user_role()` function from 0002.

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

## Changing the schema later

Add a new numbered file (`0004_*.sql`) — never edit an already-applied migration.
State the rollback in the file header (per AGENTS.md rule).
