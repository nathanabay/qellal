// Root loading UI — shown during server navigation for any route that doesn't
// define its own loading.tsx. Without this, a slow-3G navigation freezes the
// previous page with no feedback until the server responds.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy="true">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-2/3 max-w-sm rounded-lg bg-border/60" />
        <div className="h-4 w-1/2 max-w-xs rounded bg-border/50" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
