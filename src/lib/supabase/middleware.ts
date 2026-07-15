import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session cookie on every request.
// Qellal is PUBLIC — this does NOT redirect logged-out users; it only keeps
// the session token fresh so server components know who (if anyone) is signed in.
export async function updateSession(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser() (Supabase guidance).
  // Guard against a transient auth-server hiccup: a failed refresh must not break
  // the request or client navigation — pages still run their own auth checks.
  try {
    await supabase.auth.getUser();
  } catch {
    // Session not refreshed this cycle; continue serving the request.
  }

  return supabaseResponse;
}
