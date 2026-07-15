import { requireStaff } from "@/lib/auth-guard";
import { getCategories, getDistinctRegions } from "@/lib/tenders";
import { formatDate } from "@/lib/format";
import { publishTender, rejectTender, createTender } from "./actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Qellal" };

type PendingRow = {
  id: string;
  title: string;
  region: string | null;
  publishing_entity: string | null;
  deadline: string;
  source_name: string;
  created_by: string;
};

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted";

export default async function AdminPage() {
  const { supabase, role } = await requireStaff();

  const { data } = await supabase
    .from("tenders")
    .select("id,title,region,publishing_entity,deadline,source_name,created_by")
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });
  const pending = (data ?? []) as PendingRow[];

  const [categories, regions] = await Promise.all([
    getCategories(),
    getDistinctRegions(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
          {role}
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Review queue
        </h1>
        <p className="mt-1 text-sm text-muted">
          {pending.length} tender{pending.length === 1 ? "" : "s"} awaiting
          review. Publish to make them public, or reject.
        </p>
      </header>

      {pending.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Nothing to review. Scraped and submitted tenders will appear here.
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <h2 className="font-semibold text-ink">{t.title}</h2>
              <p className="mt-1 text-sm text-muted">
                {t.region ?? "Ethiopia"}
                {t.publishing_entity ? ` · ${t.publishing_entity}` : ""} ·
                Deadline {formatDate(t.deadline)}
              </p>
              <p className="mt-1 text-xs text-muted">
                Source: {t.source_name} · via {t.created_by}
              </p>
              <div className="mt-3 flex gap-2">
                <form action={publishTender}>
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton pendingText="Publishing…">Publish</SubmitButton>
                </form>
                <form action={rejectTender}>
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton variant="danger">Reject</SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Manual entry */}
      <section className="mt-10 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Add a tender manually
        </h2>
        <p className="mt-1 text-xs text-muted">
          Publishes immediately. Title, deadline and source are required.
        </p>
        <form action={createTender} className="mt-4 space-y-3">
          <input
            name="title"
            required
            placeholder="Tender title *"
            aria-label="Tender title"
            className={inputClass}
          />
          <textarea
            name="description"
            rows={3}
            placeholder="Description"
            aria-label="Description"
            className={inputClass}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select name="category_id" className={inputClass} aria-label="Category">
              <option value="">Category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              name="region"
              list="admin-regions"
              placeholder="Region"
              aria-label="Region"
              className={inputClass}
            />
            <datalist id="admin-regions">
              {regions.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <input
              name="publishing_entity"
              placeholder="Publishing entity"
              aria-label="Publishing entity"
              className={inputClass}
            />
            <input
              name="deadline"
              type="date"
              required
              className={inputClass}
              aria-label="Deadline"
            />
            <input
              name="source_name"
              required
              placeholder="Source name *"
              aria-label="Source name"
              className={inputClass}
            />
            <input
              name="source_url"
              type="url"
              placeholder="Source URL"
              aria-label="Source URL"
              className={inputClass}
            />
          </div>
          <SubmitButton pendingText="Publishing…">Publish tender</SubmitButton>
        </form>
      </section>
    </main>
  );
}
