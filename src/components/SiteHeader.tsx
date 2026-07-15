import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

async function getUserEmail(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export async function SiteHeader() {
  const email = await getUserEmail();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight text-ink"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Qellal
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/tenders"
            className="rounded-lg px-3 py-1.5 font-medium text-muted hover:bg-primary-soft hover:text-primary"
          >
            Browse tenders
          </Link>

          {email ? (
            <>
              <span className="hidden text-muted sm:inline" title={email}>
                {email}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg px-3 py-1.5 font-medium text-muted hover:bg-primary-soft hover:text-primary"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-primary px-3 py-1.5 font-medium text-white hover:bg-primary-hover"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
