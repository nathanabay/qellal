import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getTenderById, getCategories } from "@/lib/tenders";
import { getSimilarTenders } from "@/lib/insights";
import { daysLeft, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { toggleSaveTender } from "@/app/tenders/actions";
import { TenderCard } from "@/components/TenderCard";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { StarIcon } from "@/components/ui/icons";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let saved = false;
  if (user) {
    const { data } = await supabase
      .from("saved_tenders")
      .select("tender_id")
      .eq("tender_id", tender.id)
      .maybeSingle();
    saved = Boolean(data);
  }

  const [categories, similar] = await Promise.all([
    getCategories(),
    getSimilarTenders(tender.category_id, tender.id, 4),
  ]);
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
  if (tender.published_on)
    meta.push({ label: "Published on", value: tender.published_on });
  if (tender.bid_bond)
    meta.push({ label: "Bid bond", value: tender.bid_bond });
  if (tender.bid_document_price)
    meta.push({ label: "Document price", value: tender.bid_document_price });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>{" "}
        <span aria-hidden="true">/</span>{" "}
        <Link href="/tenders" className="hover:text-primary">
          Tenders
        </Link>
      </nav>

      <div className="mt-5 lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8">
        {/* Main column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {categoryName && (
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
                {categoryName}
              </span>
            )}
            {tender.region && (
              <span className="text-xs font-medium text-muted">
                {tender.region}
              </span>
            )}
          </div>
          <h1 className="mt-3 font-heading text-3xl font-bold leading-[1.15] text-ink sm:text-4xl">
            {tender.title}
          </h1>
          {tender.publishing_entity && (
            <p className="mt-3 text-sm text-muted">
              Published by{" "}
              <Link
                href={`/entities/${encodeURIComponent(tender.publishing_entity)}`}
                className="font-medium text-primary hover:underline"
              >
                {tender.publishing_entity}
              </Link>
            </p>
          )}

          {/* Description */}
          <section className="mt-8">
            <h2 className="font-heading text-lg font-semibold text-ink">
              Description
            </h2>
            <div className="mt-3 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
              {tender.description ? (
                <p className="whitespace-pre-line leading-relaxed text-ink">
                  {tender.description}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  No description provided — see the original notice for full
                  details.
                </p>
              )}
            </div>
          </section>

          {/* Source attribution (legal) */}
          <section className="mt-6 rounded-2xl border border-border bg-canvas p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Source
            </h2>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-ink">{tender.source_name}</p>
                <p className="mt-1 text-xs text-muted">
                  Always verify against the original notice before bidding.
                </p>
              </div>
              {tender.source_url && (
                <a
                  href={tender.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-primary transition-colors hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  View original ↗
                </a>
              )}
            </div>
          </section>

          {/* Similar past tenders (market intelligence) */}
          {similar.length > 0 && (
            <section className="mt-8">
              <h2 className="font-heading text-lg font-semibold text-ink">
                Similar tenders
              </h2>
              <ul className="mt-3 space-y-3">
                {similar.map((t) => (
                  <li key={t.id}>
                    <TenderCard tender={t} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-8">
            <Link
              href="/tenders"
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              ← Back to all tenders
            </Link>
          </div>
        </div>

        {/* Sticky key-facts sidebar */}
        <aside className="mt-8 lg:mt-0">
          <div className="space-y-4 lg:sticky lg:top-20">
            {/* Deadline card — the #1 anxiety, front and centre */}
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${urgency.cls}`}
              >
                {urgency.label}
              </span>
              <div className="mt-3">
                <div className="font-heading text-2xl font-bold text-ink">
                  {formatDate(tender.deadline)}
                </div>
                <div className="text-sm text-muted">Submission deadline</div>
              </div>
              <div className="mt-5">
                {user ? (
                  <form action={toggleSaveTender}>
                    <input type="hidden" name="tender_id" value={tender.id} />
                    <input
                      type="hidden"
                      name="saved"
                      value={saved ? "1" : "0"}
                    />
                    <SubmitButton
                      variant="secondary"
                      className={`w-full ${saved ? "border-primary bg-primary-soft text-primary" : ""}`}
                      aria-label={saved ? "Remove from saved" : "Save tender"}
                    >
                      <StarIcon filled={saved} />
                      {saved ? "Saved" : "Save this tender"}
                    </SubmitButton>
                  </form>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Sign in to save
                  </Link>
                )}
              </div>
              {d > 0 && (
                <p className="mt-2 text-xs text-muted">
                  {saved
                    ? "You’ll be reminded 7, 3 & 1 days before it closes."
                    : "Save it to get 7, 3 & 1-day deadline reminders."}
                </p>
              )}
            </div>

            {/* Facts */}
            {meta.length > 0 && (
              <dl className="divide-y divide-border rounded-2xl border border-border bg-surface px-5 text-sm">
                {meta.map((m) => (
                  <div
                    key={m.label}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <dt className="text-muted">{m.label}</dt>
                    <dd className="text-right font-medium text-ink">
                      {m.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
