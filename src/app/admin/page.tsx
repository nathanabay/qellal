import Link from "next/link";
import { requireStaff } from "@/lib/auth-guard";
import {
  getCategories,
  getDistinctRegions,
  getPublishedTenderCount,
} from "@/lib/tenders";
import { formatDate, daysLeft } from "@/lib/format";
import { publishTender, rejectTender, createTender } from "./actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  DocumentIcon,
  TagIcon,
  CheckCircleIcon,
  InboxIcon,
} from "@/components/ui/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — Qellal" };

type PendingRow = {
  id: string;
  title: string;
  category_id: number | null;
  region: string | null;
  publishing_entity: string | null;
  deadline: string;
  source_name: string;
  created_by: string;
};

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function DeadlinePill({ deadline }: { deadline: string }) {
  const d = daysLeft(deadline);
  const cls =
    d <= 3
      ? "bg-urgent-soft text-urgent"
      : d <= 7
        ? "bg-warn-soft text-warn"
        : "bg-primary-soft text-primary";
  return (
    <span className="whitespace-nowrap">
      {formatDate(deadline)}{" "}
      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`}>
        {d <= 0 ? "closed" : `${d}d`}
      </span>
    </span>
  );
}

function RowActions({ id }: { id: string }) {
  return (
    <div className="flex justify-end gap-2">
      <form action={publishTender}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton pendingText="Publishing…" className="px-3">
          Publish
        </SubmitButton>
      </form>
      <form action={rejectTender}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton variant="danger" className="px-3">
          Reject
        </SubmitButton>
      </form>
    </div>
  );
}

export default async function AdminPage() {
  const { supabase } = await requireStaff();

  const [pendingRes, publishedCount, totalRes, categories, regions] =
    await Promise.all([
      supabase
        .from("tenders")
        .select(
          "id,title,category_id,region,publishing_entity,deadline,source_name,created_by",
        )
        .eq("status", "pending_review")
        .order("created_at", { ascending: true }),
      getPublishedTenderCount(),
      supabase.from("tenders").select("id", { count: "exact", head: true }),
      getCategories(),
      getDistinctRegions(),
    ]);

  const pending = (pendingRes.data ?? []) as PendingRow[];
  const totalCount = totalRes.count ?? 0;
  const categoryName = (id: number | null) =>
    id != null ? (categories.find((c) => c.id === id)?.name ?? "—") : "—";

  const stats = [
    { label: "Pending review", value: pending.length, Icon: InboxIcon, tone: "bg-warn-soft text-warn" },
    { label: "Published", value: publishedCount ?? 0, Icon: CheckCircleIcon, tone: "bg-primary-soft text-primary" },
    { label: "Total tenders", value: totalCount, Icon: DocumentIcon, tone: "bg-primary-soft text-primary" },
    { label: "Categories", value: categories.length, Icon: TagIcon, tone: "bg-primary-soft text-primary" },
  ];

  return (
    <>
      {/* Page header + breadcrumb */}
          <div className="mb-5">
            <nav className="text-xs text-muted" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-primary">
                Home
              </Link>{" "}
              <span aria-hidden="true">/</span> Admin
            </nav>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
              Review queue
            </h1>
            <p className="mt-1 text-sm text-muted">
              Review manually-submitted tenders. Scraped tenders publish
              automatically.
            </p>
          </div>

          {/* KPI stat cards (ProCard-style) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted">
                    {s.label}
                  </span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.tone}`}
                  >
                    <s.Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 font-heading text-2xl font-bold tabular-nums text-ink">
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Review queue (ProTable-style) */}
          <section
            id="review"
            className="mt-6 scroll-mt-20 overflow-hidden rounded-xl border border-border bg-surface"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Pending review</h2>
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">
                {pending.length}
              </span>
            </div>

            {pending.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">
                Nothing to review. Scraped and submitted tenders will appear
                here.
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <table className="hidden w-full text-left text-sm lg:table">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th scope="col" className="px-4 py-2 font-medium">Tender</th>
                      <th scope="col" className="px-4 py-2 font-medium">Category</th>
                      <th scope="col" className="px-4 py-2 font-medium">Region</th>
                      <th scope="col" className="px-4 py-2 font-medium">Deadline</th>
                      <th scope="col" className="px-4 py-2 font-medium">Source</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-border last:border-0 hover:bg-canvas"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink">{t.title}</div>
                          <div className="text-xs text-muted">
                            via {t.created_by}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {categoryName(t.category_id)}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {t.region ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-ink">
                          <DeadlinePill deadline={t.deadline} />
                        </td>
                        <td className="px-4 py-3 text-muted">{t.source_name}</td>
                        <td className="px-4 py-3">
                          <RowActions id={t.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile cards (no horizontal scroll) */}
                <ul className="divide-y divide-border lg:hidden">
                  {pending.map((t) => (
                    <li key={t.id} className="p-4">
                      <div className="font-medium text-ink">{t.title}</div>
                      <p className="mt-1 text-xs text-muted">
                        {categoryName(t.category_id)} · {t.region ?? "Ethiopia"} ·{" "}
                        {t.source_name} · via {t.created_by}
                      </p>
                      <p className="mt-1 text-xs text-ink">
                        <DeadlinePill deadline={t.deadline} />
                      </p>
                      <div className="mt-3">
                        <RowActions id={t.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Add tender (manual entry) */}
          <section
            id="add"
            className="mt-6 scroll-mt-20 rounded-xl border border-border bg-surface p-4"
          >
            <h2 className="text-sm font-semibold text-ink">Add a tender manually</h2>
            <p className="mt-1 text-xs text-muted">
              Goes to the review queue above. Title, deadline and source are
              required.
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
              <SubmitButton pendingText="Submitting…">Submit for review</SubmitButton>
            </form>
          </section>
    </>
  );
}
