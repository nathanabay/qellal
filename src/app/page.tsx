export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
        MVP · Phase 1
      </span>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Hello Qellal
      </h1>
      <p className="max-w-sm text-sm text-gray-500 sm:text-base">
        One place for every Ethiopian tender notice — with email &amp; Telegram
        alerts so you never miss a deadline.
      </p>
    </main>
  );
}
