// Skeleton for the account dashboard (plan rail + alerts list).
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy="true">
      <span role="status" className="sr-only">
        Loading your account…
      </span>
      <div className="animate-pulse">
        <div className="h-8 w-40 rounded-lg bg-border/60" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-border/50" />
        <div className="mt-6 lg:grid lg:grid-cols-[320px_1fr] lg:gap-6 lg:items-start">
          <div className="h-40 rounded-xl bg-ink/90" />
          <div className="mt-4 space-y-3 lg:mt-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl border border-border bg-surface"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
