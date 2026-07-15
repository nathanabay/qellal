import Link from "next/link";

export const metadata = { title: "Offline — Qellal" };

export default function OfflinePage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        You&apos;re offline
      </h1>
      <p className="mt-2 text-sm text-muted">
        We couldn&apos;t reach the network. Previously viewed tenders may still be
        available — reconnect to see the latest.
      </p>
      <Link
        href="/tenders"
        className="mt-6 inline-block rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
      >
        Try again
      </Link>
    </main>
  );
}
