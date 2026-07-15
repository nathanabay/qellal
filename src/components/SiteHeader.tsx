import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

async function getHeaderUser(): Promise<{ email: string | null; isStaff: boolean }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { email: null, isStaff: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { email: null, isStaff: false };

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = data?.role ?? "user";
  return { email: user.email ?? null, isStaff: role === "staff" || role === "admin" };
}

export async function SiteHeader() {
  const { email, isStaff } = await getHeaderUser();

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
              {isStaff && (
                <Link
                  href="/admin"
                  className="rounded-lg px-3 py-1.5 font-medium text-muted hover:bg-primary-soft hover:text-primary"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/account"
                className="rounded-lg px-3 py-1.5 font-medium text-muted hover:bg-primary-soft hover:text-primary"
              >
                My alerts
              </Link>
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
