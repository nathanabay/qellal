import { requireStaff } from "@/lib/auth-guard";
import { AdminNav } from "@/components/admin/AdminNav";

// Shared admin chrome: guards staff/admin access + renders the sidebar.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = await requireStaff();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:py-8">
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
        <aside className="mb-5 lg:mb-0">
          <AdminNav role={role} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
