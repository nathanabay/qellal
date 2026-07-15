import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getTenderById, getCategories } from "@/lib/tenders";
import { daysLeft, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// cache() dedupes the DB call across generateMetadata + the page in one request.
const getTender = cache(getTenderById);

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const tender = await getTender(id);
  return {
    title: tender ? `${tender.title} — Qellal` : "Tender not found — Qellal",
  };
}

export default async function TenderDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const tender = await getTender(id);
  if (!tender) notFound();

  const categories = await getCategories();
  const categoryName =
    tender.category_id != null
      ? (categories.find((c) => c.id === tender.category_id)?.name ?? null)
      : null;

  const d = daysLeft(tender.deadline);
  const urgency =
    d <= 0
      ? { label: "Closed", cls: "bg-urgent-soft text-urgent" }
      : d <= 3
        ? { label: `${d} days left`, cls: "bg-urgent-soft text-urgent" }
        : d <= 7
          ? { label: `${d} days left`, cls: "bg-warn-soft text-warn" }
          : { label: `${d} days left`, cls: "bg-primary-soft text-primary" };

  const meta: Array<{ label: string; value: string }> = [];
  if (categoryName) meta.push({ label: "Category", value: categoryName });
  if (tender.region) meta.push({ label: "Region", value: tender.region });
  if (tender.publishing_entity)
    meta.push({ label: "Publishing entity", value: tender.publishing_entity });
  if (tender.published_date)
    meta.push({ label: "Published", value: formatDate(tender.published_date) });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/tenders"
        className="text-sm font-medium text-primary hover:text-primary-hover"
      >
        ← Back to tenders
      </Link>

      <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
        {tender.title}
      </h1>

      {/* Deadline — the user's #1 anxiety, front and centre */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${urgency.cls}`}
        >
          {urgency.label}
        </span>
        <span className="text-sm text-muted">
          Deadline:{" "}
          <span className="font-semibold text-ink">
            {formatDate(tender.deadline)}
          </span>
        </span>
      </div>

      {meta.length > 0 && (
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          {meta.map((m) => (
            <div key={m.label}>
              <dt className="text-xs uppercase tracking-wide text-muted">
                {m.label}
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-ink">{m.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {tender.description && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Description
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
            {tender.description}
          </p>
        </section>
      )}

      {/* Source attribution — legal requirement: always shown, linked when possible */}
      <section className="mt-6 rounded-xl border border-border bg-canvas p-4 text-sm">
        <span className="text-muted">Source: </span>
        {tender.source_url ? (
          <a
            href={tender.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:text-primary-hover"
          >
            {tender.source_name} ↗
          </a>
        ) : (
          <span className="font-medium text-ink">{tender.source_name}</span>
        )}
        <p className="mt-1 text-xs text-muted">
          Always verify details against the original source before bidding.
        </p>
      </section>
    </main>
  );
}
