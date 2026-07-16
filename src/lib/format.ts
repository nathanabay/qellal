// Shared, dependency-free date helpers (no moment.js — project rule).

export function daysLeft(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
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
