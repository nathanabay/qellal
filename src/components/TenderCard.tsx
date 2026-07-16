import Link from "next/link";
import { daysLeft, formatDate } from "@/lib/format";
import { toggleSaveTender } from "@/app/tenders/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { StarIcon } from "@/components/ui/icons";

export type TenderCardData = {
  id: string;
  title: string;
  region: string | null;
  deadline: string;
  source_name: string;
  publishing_entity: string | null;
  category_id: number | null;
  category_ids?: number[];
  bid_bond?: string | null;
  published_date?: string | null;
};

export function TenderCard({
  tender,
  showSave = false,
  saved = false,
  isLoggedIn = false,
}: {
  tender: TenderCardData;
  showSave?: boolean;
  saved?: boolean;
  isLoggedIn?: boolean;
}) {
  const d = daysLeft(tender.deadline);
  const closed = d <= 0;
  // Red/amber mean TIME ONLY. Neutral countdowns are ink; closed recedes to muted.
  const timeColor = closed
    ? "text-muted"
    : d <= 3
      ? "text-urgent"
      : d <= 7
        ? "text-warn"
        : "text-ink";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="min-w-0 break-words font-heading font-semibold leading-snug text-ink">
            {tender.title}
          </h2>
          {tender.publishing_entity ? (
            <p className="mt-1 truncate text-sm text-muted">
              {tender.publishing_entity}
            </p>
          ) : null}
        </div>
        {/* Countdown = the loudest element on the card. */}
        <div className={`shrink-0 text-right ${timeColor}`}>
          <div className="font-mono text-4xl font-semibold leading-none tabular-nums">
            {closed ? "—" : d}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider">
            {closed ? "Closed" : d === 1 ? "Day left" : "Days left"}
          </div>
        </div>
      </div>
      <p className="mt-3 font-mono text-xs uppercase tracking-wide text-muted">
        Closes {formatDate(tender.deadline)}
        {tender.region ? ` · ${tender.region}` : ""}
      </p>
      {tender.bid_bond ? (
        <span className="mt-2 inline-flex items-center rounded-full bg-canvas px-2 py-0.5 font-mono text-xs font-medium text-muted">
          Bid bond: {tender.bid_bond}
        </span>
      ) : null}
      <p className="mt-2 font-mono text-xs text-muted">
        Source: {tender.source_name}
      </p>
    </>
  );

  // Simple clickable card (homepage, saved list).
  if (!showSave) {
    return (
      <Link
        href={`/tenders/${tender.id}`}
        className="block rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {body}
      </Link>
    );
  }

  // Card with a save toggle: stretched link keeps the whole card clickable while
  // the save button stays a separate, valid interactive element (z-10 above it).
  return (
    <div className="relative flex h-full w-full flex-col rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
      <Link
        href={`/tenders/${tender.id}`}
        aria-label={tender.title}
        className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      {body}
      {isLoggedIn && (
        <form action={toggleSaveTender} className="relative z-10 mt-auto pt-4">
          <input type="hidden" name="tender_id" value={tender.id} />
          <input type="hidden" name="saved" value={saved ? "1" : "0"} />
          {/* One filled ink CTA per card. */}
          <SubmitButton
            variant="primary"
            className="w-full"
            aria-label={saved ? "Remove from saved" : "Save tender and get alerts"}
          >
            <StarIcon filled={saved} />
            {saved ? "Saved" : "Save & get alerts"}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
