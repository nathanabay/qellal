import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client — SERVER/CI ONLY. Bypasses RLS so the scraper can write
// pending_review rows on behalf of no logged-in user. The key lives only in
// CI secrets / local env, never in the web app or the browser.
// Created lazily so a DRY_RUN (which never writes) works without credentials.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to write tenders",
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
