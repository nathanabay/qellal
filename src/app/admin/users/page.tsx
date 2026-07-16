import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { getAllUsers, type AdminUser } from "@/lib/admin-data";
import { formatDate } from "@/lib/format";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { updateUser } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users — Qellal admin" };

const selectClass =
  "rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function ManageForm({ u, isSelf }: { u: AdminUser; isSelf: boolean }) {
  return (
    <form action={updateUser} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={u.id} />
      <select
        name="role"
        defaultValue={u.role}
        aria-label={`Role for ${u.email ?? "user"}`}
        className={selectClass}
      >
        <option value="user">user</option>
        <option value="staff">staff</option>
        <option value="admin">admin</option>
      </select>
      <select
        name="plan"
        defaultValue={u.plan}
        aria-label={`Plan for ${u.email ?? "user"}`}
        className={selectClass}
      >
        <option value="free">free</option>
        <option value="pro">pro</option>
      </select>
      <SubmitButton className="px-3" pendingText="Saving…">
        Save
      </SubmitButton>
      {isSelf && <span className="text-xs text-muted">(you)</span>}
    </form>
  );
}

export default async function AdminUsersPage() {
  const { user, role } = await requireStaff();
  if (role !== "admin") redirect("/admin");

  const users = await getAllUsers();

  return (
    <>
      <div className="mb-5">
        <nav className="text-xs text-muted" aria-label="Breadcrumb">
          <Link href="/admin" className="hover:text-primary">
            Admin
          </Link>{" "}
          <span aria-hidden="true">/</span> Users
        </nav>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Users</h1>
        <p className="mt-1 text-sm text-muted">
          {users.length} {users.length === 1 ? "user" : "users"}. Set roles and
          plans.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        {/* Desktop table */}
        <table className="hidden w-full text-left text-sm lg:table">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-2 font-medium">User</th>
              <th scope="col" className="px-4 py-2 font-medium">Company</th>
              <th scope="col" className="px-4 py-2 font-medium">Joined</th>
              <th scope="col" className="px-4 py-2 font-medium">Role &amp; plan</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-border last:border-0 hover:bg-canvas"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{u.email ?? "—"}</div>
                  {u.full_name && (
                    <div className="text-xs text-muted">{u.full_name}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {u.company_name ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-muted">
                  {u.created_at ? formatDate(u.created_at) : "—"}
                </td>
                <td className="px-4 py-3">
                  <ManageForm u={u} isSelf={u.id === user.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile cards */}
        <ul className="divide-y divide-border lg:hidden">
          {users.map((u) => (
            <li key={u.id} className="p-4">
              <div className="font-medium text-ink">{u.email ?? "—"}</div>
              <p className="mt-1 text-xs text-muted">
                {u.full_name ?? "—"} · {u.company_name ?? "no company"} ·{" "}
                {u.created_at ? formatDate(u.created_at) : "—"}
              </p>
              <div className="mt-3">
                <ManageForm u={u} isSelf={u.id === user.id} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
