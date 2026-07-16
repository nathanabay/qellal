import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Cookie-less anon client for PUBLIC, read-only aggregate queries (insights,
// entity stats, facet counts). Because it never reads cookies, pages that use
// only this client can be statically cached / revalidated (ISR) instead of
// force-dynamic. RLS still applies as the anon role (published rows only).
export function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
