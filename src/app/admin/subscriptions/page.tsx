import Link from "next/link";
import { requireStaff } from "@/lib/auth-guard";
import { getAllSubscriptions } from "@/lib/admin-data";
import { getCategories } from "@/lib/tenders";
import { formatDate } from "@/lib/format";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { adminRemoveSubscription } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscriptions — Qellal admin" };

function RemoveForm({ id }: { id: string }) {
  return (
    <form action={adminRemoveSubscription}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="danger" className="px-3">
        Remove
      </SubmitButton>
    </form>
  );
}

export default async function AdminSubscriptionsPage() {
  await requireStaff();
  const [subs, categories] = await Promise.all([
    getAllSubscriptions(),
    getCategories(),
  ]);
  const categoryName = (id: number | null) =>
    id != null ? (categories.find((c) => c.id === id)?.name ?? "—") : "—";

  const criteriaParts = (s: {
    category_id: number | null;
    keyword: string | null;
    region: string | null;
  }): string[] =>
    [
      s.category_id != null ? categoryName(s.category_id) : null,
      s.keyword ? `“${s.keyword}”` : null,
      s.region,
    ].filter((x): x is string => Boolean(x));

  const Chips = ({ parts }: { parts: string[] }) =>
    parts.length === 0 ? (
      <span className="text-muted">Any tender</span>
    ) : (
      <span className="flex flex-wrap gap-1.5">
        {parts.map((p) => (
          <span
            key={p}
            className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs text-ink"
          >
            {p}
          </span>
        ))}
      </span>
    );

  return (
    <>
      <div className="mb-5">
        <nav className="text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-primary">
            Admin
          </Link>{" "}
          <span aria-hidden="true">/</span> Subscriptions
        </nav>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          Subscriptions
        </h1>
        <p className="mt-1 text-sm text-muted">
          {subs.length} alert {subs.length === 1 ? "subscription" : "subscriptions"}{" "}
          across all users.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        {subs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            No alert subscriptions yet.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-left text-sm lg:table">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-2 font-medium">User</th>
                  <th scope="col" className="px-4 py-2 font-medium">Watching</th>
                  <th scope="col" className="px-4 py-2 font-medium">Created</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border last:border-0 hover:bg-canvas"
                  >
                    <td className="px-4 py-3 text-ink">{s.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      <Chips parts={criteriaParts(s)} />
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-muted">
                      {s.created_at ? formatDate(s.created_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <RemoveForm id={s.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-border lg:hidden">
              {subs.map((s) => (
                <li key={s.id} className="p-4">
                  <div className="font-medium text-ink">{s.email ?? "—"}</div>
                  <div className="mt-1.5 text-sm text-muted">
                    <Chips parts={criteriaParts(s)} />
                  </div>
                  <p className="mt-1.5 font-mono text-xs tabular-nums text-muted">
                    {s.created_at ? formatDate(s.created_at) : "—"}
                  </p>
                  <div className="mt-3">
                    <RemoveForm id={s.id} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
