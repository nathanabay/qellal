import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for SERVER components, route handlers, and server actions.
 * Reads/writes the auth session from cookies. Uses the public anon key —
 * RLS policies enforce what this client is allowed to see.
 *
 * Usage (server component):
 *   const supabase = await createClient();
 *   const { data } = await supabase.from("tenders").select(...);
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Safe to ignore — session refresh happens in middleware.
          }
        },
      },
    },
  );
}
