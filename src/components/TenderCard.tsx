import Link from "next/link";
import { daysLeft, formatDate } from "@/lib/format";

export type TenderCardData = {
  id: string;
  title: string;
  region: string | null;
  deadline: string;
  source_name: string;
  publishing_entity: string | null;
};

export function TenderCard({ tender }: { tender: TenderCardData }) {
  const d = daysLeft(tender.deadline);

  // Deadline is the user's #1 anxiety — colour it by urgency.
  const badgeClass =
    d <= 3
      ? "bg-urgent-soft text-urgent"
      : d <= 7
        ? "bg-warn-soft text-warn"
        : "bg-primary-soft text-primary";

  return (
    <Link
      href={`/tenders/${tender.id}`}
      className="block rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted">
        <span>
          Deadline:{" "}
          <span className="font-medium text-ink">
            {formatDate(tender.deadline)}
          </span>
        </span>
        <span>Source: {tender.source_name}</span>
      </div>
    </Link>
  );
}
