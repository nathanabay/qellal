// Skeleton for a single tender's detail page.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8" aria-busy="true">
      <span role="status" className="sr-only">
        Loading tender…
      </span>
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 rounded bg-border/50" />
        <div className="h-9 w-full max-w-xl rounded-lg bg-border/60" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 w-24 rounded-full bg-surface" />
          ))}
        </div>
        <div className="mt-4 h-40 rounded-xl border border-border bg-surface" />
        <div className="h-64 rounded-xl border border-border bg-surface" />
      </div>
    </main>
  );
}
