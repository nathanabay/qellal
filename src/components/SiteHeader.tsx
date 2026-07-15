import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight text-ink"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Qellal
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/tenders"
            className="rounded-lg px-3 py-1.5 font-medium text-muted hover:bg-primary-soft hover:text-primary"
          >
            Browse tenders
          </Link>
        </nav>
      </div>
    </header>
  );
}
