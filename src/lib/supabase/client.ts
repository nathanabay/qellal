import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for CLIENT components ('use client').
 * Uses the public anon key only — never the service role key in the browser.
 *
 * Usage (client component):
 *   const supabase = createClient();
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
