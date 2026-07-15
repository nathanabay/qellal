import Link from "next/link";

export const metadata = { title: "Link problem — Qellal" };

export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-12 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        That link didn&apos;t work
      </h1>
      <p className="mt-2 text-sm text-muted">
        The confirmation or reset link may have expired or already been used.
        Please request a new one.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Link
          href="/login"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          Back to sign in
        </Link>
        <Link
          href="/auth/reset"
          className="text-sm text-primary hover:text-primary-hover"
        >
          Request a new reset link
        </Link>
      </div>
    </main>
  );
}
