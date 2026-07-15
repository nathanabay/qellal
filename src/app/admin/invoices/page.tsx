import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { getAllInvoices } from "@/lib/invoicing";
import { formatDate } from "@/lib/format";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { adjustInvoice } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoices — Qellal admin" };

const inputClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function statusBadge(status: string) {
  return status === "paid"
    ? "bg-primary-soft text-primary"
    : status === "credit"
      ? "bg-warn-soft text-warn"
      : "bg-canvas text-muted";
}

export default async function AdminInvoicesPage() {
  const { role } = await requireStaff();
  if (role !== "admin") redirect("/admin");

  const invoices = await getAllInvoices();

  return (
    <>
      <div className="mb-5">
        <nav className="text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-primary">
            Admin
          </Link>{" "}
          <span aria-hidden="true">/</span> Invoices
        </nav>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          Invoices
        </h1>
        <p className="mt-1 text-sm text-muted">
          {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}.
          Test mode — no real payments.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            No invoices yet. They generate when a user upgrades or cancels.
          </div>
        ) : (
          <>
            <table className="hidden w-full text-left text-sm lg:table">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-2 font-medium">Invoice</th>
                  <th scope="col" className="px-4 py-2 font-medium">User</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">
                      {inv.number}
                    </td>
                    <td className="px-4 py-3 text-muted">{inv.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(inv.status)}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {inv.created_at ? formatDate(inv.created_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                      ETB {inv.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-border lg:hidden">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 p-4">
                  <div>
                    <div className="font-medium text-ink">{inv.number}</div>
                    <p className="mt-0.5 text-xs text-muted">
                      {inv.email ?? "—"} ·{" "}
                      {inv.created_at ? formatDate(inv.created_at) : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(inv.status)}`}
                    >
                      {inv.status}
                    </span>
                    <div className="mt-1 font-semibold tabular-nums text-ink">
                      ETB {inv.total.toFixed(2)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Invoice adjustment (proration repairs / credits) */}
      {invoices.length > 0 && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">Add an adjustment</h2>
          <p className="mt-1 text-xs text-muted">
            Add a charge (positive) or credit (negative ETB) to an invoice. Total
            recomputes automatically.
          </p>
          <form
            action={adjustInvoice}
            className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4"
          >
            <select name="invoice_id" required className={inputClass} aria-label="Invoice">
              <option value="">Invoice…</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number} ({inv.email ?? "—"})
                </option>
              ))}
            </select>
            <input
              name="description"
              required
              placeholder="Reason (e.g. goodwill credit)"
              aria-label="Adjustment description"
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              name="amount"
              type="number"
              step="0.01"
              required
              placeholder="Amount ETB"
              aria-label="Amount in ETB"
              className={inputClass}
            />
            <div className="sm:col-span-4">
              <SubmitButton pendingText="Applying…">Apply adjustment</SubmitButton>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
