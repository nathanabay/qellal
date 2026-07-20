import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  getCategories,
  getTenderById,
  getTenderCategories,
} from "@/lib/tenders";
import { getSimilarTenders } from "@/lib/insights";
import { daysLeft, formatDate } from "@/lib/format";
import { entityHref } from "@/lib/entity";
import { createClient } from "@/lib/supabase/server";
import { toggleSaveTender } from "@/app/tenders/actions";
import { TenderCard } from "@/components/TenderCard";
import { TenderActions } from "@/components/TenderActions";
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
  // Independent of each other — run in parallel once we have the tender.
  const [userRes, joinCats] = await Promise.all([
    supabase.auth.getUser(),
    getTenderCategories(tender.id),
  ]);
  const user = userRes.data.user;

  // Prefer the many-to-many join; fall back to the primary category_id so
  // tenders without join rows (e.g. manually-added ones) still show a category.
  const tenderCats =
    joinCats.length > 0
      ? joinCats
      : tender.category_id != null
        ? (await getCategories()).filter((c) => c.id === tender.category_id)
        : [];
  const catIds = tenderCats.map((c) => c.id);

  // Saved-status and similar tenders are independent — run them together.
  const [savedRes, similar] = await Promise.all([
    user
      ? supabase
          .from("saved_tenders")
          .select("tender_id")
          .eq("tender_id", tender.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getSimilarTenders(catIds, tender.id, 4),
  ]);
  const saved = Boolean(savedRes.data);

  const d = daysLeft(tender.deadline);
  const closed = d <= 0;
  // Red/amber mean TIME ONLY; neutral & closed states stay paper on the ink card.
  const countdownColor = closed
    ? "text-canvas/60"
    : d <= 3
      ? "text-urgent"
      : d <= 7
        ? "text-warn"
        : "text-canvas";

  // Facts shown in the ink hero (mono). Categories lead — they're also clickable
  // chips at the top of the column, but the card is the at-a-glance data summary.
  const facts: Array<{ label: string; value: string }> = [];
  if (tenderCats.length > 0)
    facts.push({
      label: tenderCats.length > 1 ? "Categories" : "Category",
      value: tenderCats.map((c) => c.name).join(", "),
    });
  if (tender.region) facts.push({ label: "Region", value: tender.region });
  if (tender.published_date)
    facts.push({ label: "Published", value: formatDate(tender.published_date) });
  if (tender.published_on)
    facts.push({ label: "Published on", value: tender.published_on });
  if (tender.bid_bond) facts.push({ label: "Bid bond", value: tender.bid_bond });
  if (tender.bid_document_price)
    facts.push({ label: "Doc price", value: tender.bid_document_price });
  facts.push({ label: "Source", value: tender.source_name });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="no-print text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>{" "}
        <span aria-hidden="true">/</span>{" "}
        <Link href="/tenders" className="hover:text-primary">
          Tenders
        </Link>
      </nav>

      <div className="tender-detail-grid mt-5 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
        {/* Main column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {tenderCats.map((c) => (
              <Link
                key={c.id}
                href={`/tenders?category=${c.slug}`}
                className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/15"
              >
                {c.name}
              </Link>
            ))}
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
                href={entityHref(tender.publishing_entity)}
                className="font-medium text-primary hover:underline"
              >
                {tender.publishing_entity}
              </Link>
            </p>
          )}

          <TenderActions
            title={tender.title}
            facts={facts}
            sourceUrl={tender.source_url}
          />

          {/* Description */}
          <section className="mt-8">
            <h2 className="font-heading text-lg font-semibold text-ink">
              Description
            </h2>
            <div className="mt-3 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
              {tender.description ? (
                <div
                  className="tender-desc leading-relaxed text-ink"
                  // Sanitized at scrape time to a safe tag whitelist (no attrs,
                  // scripts or links) so we can keep 2merkato's formatting.
                  dangerouslySetInnerHTML={{ __html: tender.description }}
                />
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
            <section className="no-print mt-8">
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

          <div className="no-print mt-8">
            <Link
              href="/tenders"
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              ← Back to all tenders
            </Link>
          </div>
        </div>

        {/* Sticky ink deadline hero — the countdown is the loudest element. */}
        <aside className="mt-8 lg:mt-0">
          <div className="lg:sticky lg:top-6">
            <div className="tender-deadline-card rounded-2xl bg-ink p-6 text-canvas shadow-[var(--shadow-lift)]">
              <p className="font-mono text-xs uppercase tracking-widest text-canvas/60">
                {closed ? "Closed" : "Closes in"}
              </p>
              <div
                className={`mt-2 font-mono font-semibold leading-none tabular-nums ${countdownColor}`}
                style={{ fontSize: "72px" }}
              >
                {closed ? "—" : d}
              </div>
              <p className="mt-2 font-mono text-xs uppercase tracking-wide text-canvas/60">
                {closed
                  ? `Closed ${formatDate(tender.deadline)}`
                  : `${d === 1 ? "day" : "days"} · closes ${formatDate(tender.deadline)}`}
              </p>

              <div className="no-print mt-6">
                {user ? (
                  <form action={toggleSaveTender}>
                    <input type="hidden" name="tender_id" value={tender.id} />
                    <input
                      type="hidden"
                      name="saved"
                      value={saved ? "1" : "0"}
                    />
                    <SubmitButton
                      variant="invert"
                      className="w-full"
                      aria-label={saved ? "Remove from saved" : "Save tender and get alerts"}
                    >
                      <StarIcon filled={saved} />
                      {saved ? "Saved" : "Save & get alerts"}
                    </SubmitButton>
                  </form>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-canvas/30 px-4 text-sm font-medium text-canvas hover:bg-canvas/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-canvas"
                  >
                    Sign in to save
                  </Link>
                )}
              </div>
              {d > 0 && (
                <p className="mt-3 text-xs text-canvas/70">
                  {saved
                    ? "You’ll be reminded 7, 3 & 1 days before it closes."
                    : "Save it to get 7, 3 & 1-day deadline reminders."}
                </p>
              )}

              {facts.length > 0 && (
                <dl className="mt-5 space-y-2 border-t border-canvas/15 pt-4 font-mono text-xs">
                  {facts.map((m) => (
                    <div
                      key={m.label}
                      className="flex items-start justify-between gap-3"
                    >
                      <dt className="shrink-0 uppercase tracking-wide text-canvas/50">
                        {m.label}
                      </dt>
                      <dd className="min-w-0 break-words text-right text-canvas">
                        {m.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
