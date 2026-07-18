import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { PLAN_LIST, FEATURE_LABELS } from "@/lib/plans";
import { CheckIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans & roles — Qellal admin" };

const ROLES = [
  {
    role: "user",
    can: "Browse tenders, save alerts & bookmarks, manage their own account.",
  },
  {
    role: "staff",
    can: "Everything a user can, plus review/publish tenders and view all subscriptions.",
  },
  {
    role: "admin",
    can: "Everything staff can, plus manage users’ roles and plans.",
  },
];

export default async function AdminPlansPage() {
  const { role } = await requireStaff();
  if (role !== "admin") redirect("/admin");

  return (
    <>
      <div className="mb-5">
        <nav className="text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-primary">
            Admin
          </Link>{" "}
          <span aria-hidden="true">/</span> Plans &amp; roles
        </nav>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          Plans &amp; roles
        </h1>
        <p className="mt-1 text-sm text-muted">
          Plan catalog (config-driven) and what each role can do.
        </p>
      </div>

      {/* Catalog */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PLAN_LIST.map((plan) => (
          <div
            key={plan.id}
            className="rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-heading text-lg font-bold text-ink">
                {plan.name}
              </h2>
              <p className="font-mono text-sm font-semibold tabular-nums text-ink">
                {plan.priceEtbMonthly === 0
                  ? "Free"
                  : `ETB ${plan.priceEtbMonthly}/mo`}
              </p>
            </div>
            <p className="mt-1 text-sm text-muted">{plan.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-ink">
              {plan.features
                .filter((f) => f !== "unlimited_subscriptions")
                .map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-primary" />
                    {FEATURE_LABELS[f]}
                  </li>
                ))}
              <li className="flex items-center gap-2 text-muted">
                <CheckIcon className="h-4 w-4 text-primary" />
                {plan.limits.subscriptions === null
                  ? "Unlimited saved alerts"
                  : `Up to ${plan.limits.subscriptions} saved alerts`}
              </li>
            </ul>
          </div>
        ))}
      </section>

      <p className="mt-3 text-xs text-muted">
        This catalog is read-only. Checkout runs through Chapa (sandbox); an admin
        can also set a user&apos;s plan on the Users page, which updates their
        billing subscription. Entitlement limits are enforced once the free period
        ends.
      </p>

      {/* Roles reference */}
      <section className="mt-8 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Roles &amp; permissions</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-2 font-medium">Role</th>
              <th scope="col" className="px-4 py-2 font-medium">Can do</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.role} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <span className="rounded-full border border-border bg-canvas px-2 py-0.5 text-xs font-semibold text-muted">
                    {r.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{r.can}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border px-4 py-3 text-xs text-muted">
          Change a user’s role on the{" "}
          <Link href="/admin/users" className="text-primary hover:text-primary-hover">
            Users
          </Link>{" "}
          page.
        </p>
      </section>
    </>
  );
}
