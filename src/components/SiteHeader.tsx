import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { NavLink } from "@/components/ui/NavLink";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { BrandMark } from "@/components/ui/BrandMark";

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
          className="flex min-h-11 items-center gap-2 font-heading text-lg font-bold tracking-tight text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <BrandMark className="h-5 w-5" />
          Qellal
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/tenders">Browse</NavLink>
          <NavLink href="/insights">Insights</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>

          {email ? (
            <>
              {isStaff && <NavLink href="/admin">Admin</NavLink>}
              <NavLink href="/account">My alerts</NavLink>
              <span className="hidden text-muted sm:inline" title={email}>
                {email}
              </span>
              <form action={signOut}>
                <SubmitButton variant="ghost" pendingText="Signing out…">
                  Sign out
                </SubmitButton>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-3 font-medium text-white hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
