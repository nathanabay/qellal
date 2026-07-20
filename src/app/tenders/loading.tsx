// Skeleton for the tender list — a row of filter placeholders plus card
// placeholders, so paging/filtering shows immediate feedback on slow networks.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8" aria-busy="true">
      <span role="status" className="sr-only">
        Loading tenders…
      </span>
      <div className="animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-border/60" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 w-32 rounded-lg bg-surface" />
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
