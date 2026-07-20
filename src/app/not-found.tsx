import Link from "next/link";

// Branded 404. `notFound()` (used on the tender detail page) renders this
// instead of the unstyled default.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold text-muted">404</p>
      <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-ink">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-muted">
        That tender or page doesn&apos;t exist, or may have closed and been
        removed.
      </p>
      <Link
        href="/tenders"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-medium text-canvas"
      >
        Browse tenders
      </Link>
    </main>
  );
}
