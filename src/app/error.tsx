"use client";

import { useEffect } from "react";

// Root error boundary — catches uncaught render/data errors (e.g. Supabase or
// Meili throwing outside a handled path) so users see a branded recovery screen
// instead of Next's raw default error page. `reset` retries the segment.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for logs/observability (console.error survives the
    // production console strip in next.config.ts).
    console.error("Unhandled page error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-heading text-2xl font-bold tracking-tight text-ink">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-muted">
        We hit an unexpected error loading this page. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-medium text-canvas"
      >
        Try again
      </button>
    </main>
  );
}
