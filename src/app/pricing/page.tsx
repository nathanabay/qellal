import Link from "next/link";
import { PLAN_LIST, FEATURE_LABELS, type Feature } from "@/lib/plans";
import { CheckIcon } from "@/components/ui/icons";

export const metadata = {
  title: "Pricing — Qellal",
  description:
    "Simple, transparent pricing for Ethiopian tender alerts. Start free — no card required.",
};

// Every feature we might list, in display order, so each plan shows the full
// set with checks/dashes (transparency — report §8: own the pricing clarity gap).
const ALL_FEATURES: Feature[] = [
  "email_alerts",
  "telegram_alerts",
  "instant_alerts",
  "unlimited_subscriptions",
  "priority_support",
];

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <header className="text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
          Pricing
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
          Start free and never miss a deadline. Upgrade only when you&apos;re
          tracking many opportunities at once. Prices are in Ethiopian Birr, per
          month. No hidden fees.
        </p>
      </header>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {PLAN_LIST.map((plan) => {
          const isPro = plan.id === "pro";
          const limit = plan.limits.subscriptions;
          return (
            <section
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-6 ${
                isPro
                  ? "border-transparent bg-ink text-canvas shadow-[var(--shadow-lift)]"
                  : "border-border bg-surface"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2
                  className={`font-heading text-lg font-bold ${isPro ? "text-canvas" : "text-ink"}`}
                >
                  {plan.name}
                </h2>
                {isPro && (
                  <span className="rounded-full bg-urgent px-2.5 py-0.5 text-xs font-semibold text-white">
                    Most features
                  </span>
                )}
              </div>

              <p
                className={`mt-1 text-sm ${isPro ? "text-canvas/70" : "text-muted"}`}
              >
                {plan.description}
              </p>

              <div className="mt-5 flex items-end gap-1">
                <span
                  className={`font-heading text-4xl font-bold tabular-nums ${isPro ? "text-canvas" : "text-ink"}`}
                >
                  {plan.priceEtbMonthly === 0
                    ? "Free"
                    : `${plan.priceEtbMonthly} ETB`}
                </span>
                {plan.priceEtbMonthly > 0 && (
                  <span
                    className={`pb-1 text-sm ${isPro ? "text-canvas/60" : "text-muted"}`}
                  >
                    /month
                  </span>
                )}
              </div>

              <ul className="mt-6 space-y-2.5 text-sm">
                {ALL_FEATURES.map((feat) => {
                  const included = plan.features.includes(feat);
                  return (
                    <li key={feat} className="flex items-start gap-2.5">
                      {included ? (
                        <CheckIcon
                          className={`mt-0.5 h-4 w-4 shrink-0 ${isPro ? "text-canvas" : "text-primary"}`}
                        />
                      ) : (
                        <span
                          className={`mt-0.5 h-4 w-4 shrink-0 text-center leading-4 ${isPro ? "text-canvas/30" : "text-muted"}`}
                          aria-hidden="true"
                        >
                          –
                        </span>
                      )}
                      <span
                        className={
                          included
                            ? isPro
                              ? "text-canvas"
                              : "text-ink"
                            : isPro
                              ? "text-canvas/40"
                              : "text-muted"
                        }
                      >
                        {FEATURE_LABELS[feat]}
                      </span>
                    </li>
                  );
                })}
                <li className="flex items-start gap-2.5">
                  <CheckIcon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${isPro ? "text-canvas" : "text-primary"}`}
                  />
                  <span className={isPro ? "text-canvas" : "text-ink"}>
                    {limit === null
                      ? "Unlimited saved alerts"
                      : `Up to ${limit} saved alerts`}
                  </span>
                </li>
              </ul>

              <div className="mt-6 pt-2">
                {isPro ? (
                  <Link
                    href="/account"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-canvas px-4 text-sm font-semibold text-ink hover:bg-canvas/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-canvas"
                  >
                    Upgrade to Pro
                  </Link>
                ) : (
                  <Link
                    href="/signup"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-primary hover:bg-primary-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Create free account
                  </Link>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mx-auto mt-8 max-w-xl text-center text-xs text-muted">
        Payments are handled securely by Chapa — card details are never stored on
        Qellal. Cancel anytime; downgrading keeps your account on the Free plan.
      </p>
    </main>
  );
}
