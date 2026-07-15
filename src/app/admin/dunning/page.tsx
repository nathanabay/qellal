import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { DUNNING, isRenewalDue, nextDunningAction } from "@/lib/dunning";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { runDunning } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dunning — Qellal admin" };

function statusBadge(status: string) {
  return status === "past_due"
    ? "bg-urgent-soft text-urgent"
    : status === "active" || status === "trialing"
      ? "bg-primary-soft text-primary"
      : "bg-canvas text-muted";
}

export default async function AdminDunningPage() {
  const { role } = await requireStaff();
  if (role !== "admin") redirect("/admin");

  const supabase = await createClient();
  const now = new Date();

  const [{ data: subs }, { data: profs }] = await Promise.all([
    supabase
      .from("billing_subscriptions")
      .select(
        "user_id,plan_id,status,current_period_end,past_due_since,dunning_attempt",
      ),
    supabase.from("profiles").select("id,email"),
  ]);
  const emailById = new Map((profs ?? []).map((p) => [p.id, p.email]));

  const rows = (subs ?? []).map((s) => {
    const action = isRenewalDue(s, now)
      ? "renewal due"
      : s.status === "past_due"
        ? nextDunningAction(s, now)
        : "—";
    const daysOverdue = s.past_due_since
      ? Math.floor((now.getTime() - new Date(s.past_due_since).getTime()) / 86_400_000)
      : null;
    return { ...s, email: emailById.get(s.user_id) ?? null, action, daysOverdue };
  });
  const pastDue = rows.filter((r) => r.status === "past_due").length;

  return (
    <>
      <div className="mb-5">
        <nav className="text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-primary">
            Admin
          </Link>{" "}
          <span aria-hidden="true">/</span> Dunning
        </nav>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          Dunning
        </h1>
        <p className="mt-1 text-sm text-muted">
          Overdue collections. {pastDue} subscription{pastDue === 1 ? "" : "s"}{" "}
          past due.
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-ink">
          Policy: retry the charge on day{" "}
          <span className="font-semibold">{DUNNING.retryDays.join(", ")}</span>{" "}
          after a failure; downgrade to Free after{" "}
          <span className="font-semibold">{DUNNING.graceDays} days</span> grace.
        </p>
        <div className="mt-3">
          <form action={runDunning}>
            <SubmitButton pendingText="Processing…">
              Run dunning cycle
            </SubmitButton>
          </form>
        </div>
        <p className="mt-2 text-xs text-muted">
          Renewals are charged via Chapa; a failed charge drives the sub to past
          due → retries → downgrade. Recurring auto-charge needs a saved payment
          method (Chapa tokenization) + a daily cron — not yet wired, so renewals
          currently fail into dunning.
        </p>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            No billing subscriptions yet.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-2 font-medium">User</th>
                <th scope="col" className="px-4 py-2 font-medium">Status</th>
                <th scope="col" className="px-4 py-2 font-medium">Period ends</th>
                <th scope="col" className="px-4 py-2 font-medium">Overdue</th>
                <th scope="col" className="px-4 py-2 font-medium">Attempts</th>
                <th scope="col" className="px-4 py-2 font-medium">Next action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-ink">{r.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {r.current_period_end ? formatDate(r.current_period_end) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {r.daysOverdue !== null ? `${r.daysOverdue}d` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{r.dunning_attempt ?? 0}</td>
                  <td className="px-4 py-3 font-medium text-ink">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
