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
  const badgeClass =
    d <= 3
      ? "bg-urgent-soft text-urgent"
      : d <= 7
        ? "bg-warn-soft text-warn"
        : "bg-primary-soft text-primary";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold leading-snug text-ink">{tender.title}</h2>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
        >
          {d <= 0 ? "Closed" : `${d}d left`}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        {tender.region ?? "Ethiopia"}
        {tender.publishing_entity ? ` · ${tender.publishing_entity}` : ""}
      </p>
      {tender.bid_bond ? (
        <span className="mt-2 inline-flex items-center rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
          Bid bond: {tender.bid_bond}
        </span>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted">
        <span>
          Deadline:{" "}
          <span className="font-medium text-ink">
            {formatDate(tender.deadline)}
          </span>
        </span>
        <span>Source: {tender.source_name}</span>
      </div>
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
    <div className="relative rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
      <Link
        href={`/tenders/${tender.id}`}
        aria-label={tender.title}
        className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      {body}
      {isLoggedIn && (
        <form action={toggleSaveTender} className="relative z-10 mt-3">
          <input type="hidden" name="tender_id" value={tender.id} />
          <input type="hidden" name="saved" value={saved ? "1" : "0"} />
          <SubmitButton
            variant="secondary"
            className={saved ? "border-primary bg-primary-soft text-primary" : ""}
            aria-label={saved ? "Remove from saved" : "Save tender"}
          >
            <StarIcon filled={saved} />
            {saved ? "Saved" : "Save"}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
