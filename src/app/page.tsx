import Link from "next/link";
import {
  getPublishedTenders,
  getOpenTenderCount,
  getCategories,
} from "@/lib/tenders";
import { TenderCard } from "@/components/TenderCard";
import {
  DocumentIcon,
  StarIcon,
  BellIcon,
  CheckCircleIcon,
} from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-6 font-semibold text-white shadow-[var(--shadow-card)] transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const btnSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-6 font-medium text-ink transition-colors hover:bg-primary-soft hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const steps = [
  {
    Icon: DocumentIcon,
    title: "Browse every tender",
    body: "One feed aggregated from official Ethiopian sources — no more checking ten portals a day.",
  },
  {
    Icon: StarIcon,
    title: "Save your search",
    body: "Filter by category, region or keyword, then save it as a recurring alert in one tap.",
  },
  {
    Icon: BellIcon,
    title: "Get alerted early",
    body: "Email & Telegram reminders a week before the deadline — so your bid is never late.",
  },
];

const features = [
  {
    title: "Deadline-forward",
    body: "Every tender shows days-to-deadline, colour-coded by urgency — the number you care about, first.",
  },
  {
    title: "Source-attributed",
    body: "Each listing links to its official original notice, so you can always verify before you bid.",
  },
  {
    title: "Market intelligence",
    body: "See who tenders most, activity by sector and month, and similar past tenders — insight 2merkato doesn’t give you.",
  },
];

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="bg-surface px-4 py-8 text-center">
      <div className="font-heading text-3xl font-bold tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
    </div>
  );
}

export default async function Home() {
  const [soon, count, categories] = await Promise.all([
    getPublishedTenders({ limit: 3, sort: "deadline" }),
    getOpenTenderCount(),
    getCategories(),
  ]);
  const openCount = count ?? 0;
  const categoryCount = categories.length || 17;

  return (
    <main>
      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-14 pt-16 text-center sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-primary shadow-[var(--shadow-card)]">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
          Ethiopian tender intelligence
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.08] text-ink sm:text-6xl">
          Never miss a tender deadline again
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
          Qellal gathers every Ethiopian tender notice into one feed and alerts
          you by email &amp; Telegram — a week before the deadline, so your bid
          is never late.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/tenders" className={btnPrimary}>
            Browse tenders{openCount > 0 ? ` (${openCount})` : ""}
          </Link>
          <Link href="/signup" className={btnSecondary}>
            Create free account
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted">
          Free · No account needed to browse · Sources always attributed
        </p>
      </section>

      {/* Stat strip */}
      <section className="border-y border-border">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <Stat value={openCount} label="Live tenders" />
          <Stat value={categoryCount} label="Sectors" />
          <Stat value="2" label="Alert channels" />
          <Stat value="ETB 0" label="To get started" />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
        <h2 className="text-center text-2xl font-bold text-ink sm:text-3xl">
          How Qellal works
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-muted">
          From scattered portals to a single alert, in three steps.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <s.Icon className="h-5 w-5" />
              </div>
              <span
                aria-hidden="true"
                className="absolute right-5 top-4 font-heading text-4xl font-bold text-hairline"
              >
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Explore */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: "/categories", label: "Browse by sector", sub: `${categoryCount} sectors` },
            { href: "/regions", label: "Browse by region", sub: "Across Ethiopia" },
            { href: "/insights", label: "Market insights", sub: "Trends & activity" },
            { href: "/entities", label: "Top buyers", sub: "Who tenders most" },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="block font-semibold text-ink">{c.label}</span>
              <span className="mt-0.5 block text-xs text-muted">{c.sub}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Closing soon */}
      {soon.state === "ok" && soon.tenders.length > 0 && (
        <section className="mx-auto w-full max-w-2xl px-4 pb-16">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-bold text-ink">Closing soon</h2>
            <Link
              href="/tenders"
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              View all →
            </Link>
          </div>
          <ul className="space-y-3">
            {soon.tenders.map((t) => (
              <li key={t.id}>
                <TenderCard tender={t} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Features */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <CheckCircleIcon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-navy">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h2 className="mx-auto max-w-2xl text-2xl font-bold text-white sm:text-3xl">
            Start tracking tenders in under a minute
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-300">
            Create a free account, save your first alert, and let Qellal watch
            the deadlines for you.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-6 font-semibold text-navy transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Create free account
            </Link>
            <Link
              href="/tenders"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/25 px-6 font-medium text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Browse tenders
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
