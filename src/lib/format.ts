// Shared, dependency-free date helpers (no moment.js — project rule).

// Whole calendar days until the deadline, computed date-only in UTC so it agrees
// with the "open" filter (deadline >= today, date string compare). A deadline
// today returns 0 (still open — closes today); a passed deadline is negative.
export function daysLeft(deadline: string): number {
  const now = new Date();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const dl = new Date(deadline);
  const due = Date.UTC(dl.getUTCFullYear(), dl.getUTCMonth(), dl.getUTCDate());
  return Math.round((due - today) / 86_400_000);
}

// Day-month-year, but let the runtime pick the locale ordering/month names
// (server renders a stable default; the client re-renders in the user's locale).
const dateFmt = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}
