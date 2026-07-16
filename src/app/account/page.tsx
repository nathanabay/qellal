import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSubscriptions } from "@/lib/account";
import { getSavedTenders } from "@/lib/saved";
import { getCategories, getDistinctRegions } from "@/lib/tenders";
import { TenderCard } from "@/components/TenderCard";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CheckIcon } from "@/components/ui/icons";
import { getBillingSubscription } from "@/lib/billing";
import { getUserInvoices } from "@/lib/invoicing";
import { getPlan } from "@/lib/plans";
import { formatDate } from "@/lib/format";
import {
  updateNotificationPrefs,
  addSubscription,
  removeSubscription,
  setNotificationPause,
} from "./actions";
import {
  startTrial,
  checkoutPro,
  pausePlan,
  resumePlan,
  cancelPlan,
} from "./plan-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your alerts — Qellal" };

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const upgraded = sp.upgraded === "1";
  const paymentFailed = sp.payment === "failed" || sp.payment === "error";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, subs, categories, regions, saved, billing, invoices] =
    await Promise.all([
      getProfile(),
      getSubscriptions(),
      getCategories(),
      getDistinctRegions(),
      getSavedTenders(),
      getBillingSubscription(),
      getUserInvoices(),
    ]);

  const status = billing?.status ?? null;
  const effectivePlan =
    billing && status !== "canceled" ? billing.plan_id : "free";
  const planName = getPlan(effectivePlan).name;
  const statusLine =
    status === "trialing"
      ? `Pro trial — ends ${billing?.trial_ends_at ? formatDate(billing.trial_ends_at) : "soon"}.`
      : status === "active"
        ? `Pro — renews ${billing?.current_period_end ? formatDate(billing.current_period_end) : "monthly"}.`
        : status === "paused"
          ? "Pro — paused."
          : "You're on the Free plan.";

  const categoryName = (id: number | null) =>
    id != null ? (categories.find((c) => c.id === id)?.name ?? null) : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Your alerts
        </h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as {profile?.email ?? user.email}. Choose how you&apos;re
          notified and which tenders to watch.
        </p>
      </header>

      {upgraded && (
        <div
          role="status"
          className="mb-6 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft p-4 text-sm text-primary"
        >
          <CheckIcon className="h-4 w-4" />
          Payment received — you&apos;re on Pro. Thanks!
        </div>
      )}
      {paymentFailed && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-urgent/40 bg-urgent-soft p-4 text-sm text-urgent"
        >
          Payment wasn&apos;t completed. You can try again below.
        </div>
      )}

      {/* Plan & subscription lifecycle (Slice 2 — test mode, no real charge) */}
      <section className="mb-6 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Your plan
          </h2>
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
            {planName}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink">{statusLine}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(status === null || status === "canceled") && (
            <>
              <form action={startTrial}>
                <SubmitButton variant="secondary" className="px-3" pendingText="Starting…">
                  Start 14-day Pro trial
                </SubmitButton>
              </form>
              <form action={checkoutPro}>
                <SubmitButton className="px-3" pendingText="Upgrading…">
                  Upgrade to Pro
                </SubmitButton>
              </form>
            </>
          )}
          {status === "trialing" && (
            <>
              <form action={checkoutPro}>
                <SubmitButton className="px-3" pendingText="Activating…">
                  Activate Pro now
                </SubmitButton>
              </form>
              <form action={pausePlan}>
                <SubmitButton variant="secondary" className="px-3">
                  Pause
                </SubmitButton>
              </form>
              <form action={cancelPlan}>
                <SubmitButton variant="danger" className="px-3">
                  Cancel
                </SubmitButton>
              </form>
            </>
          )}
          {status === "active" && (
            <>
              <form action={pausePlan}>
                <SubmitButton variant="secondary" className="px-3">
                  Pause
                </SubmitButton>
              </form>
              <form action={cancelPlan}>
                <SubmitButton variant="danger" className="px-3">
                  Cancel Pro → Free
                </SubmitButton>
              </form>
            </>
          )}
          {status === "paused" && (
            <>
              <form action={resumePlan}>
                <SubmitButton className="px-3" pendingText="Resuming…">
                  Resume
                </SubmitButton>
              </form>
              <form action={cancelPlan}>
                <SubmitButton variant="danger" className="px-3">
                  Cancel
                </SubmitButton>
              </form>
            </>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Upgrading redirects you to Chapa to pay securely. Card details are
          handled by Chapa, never stored here.
        </p>
      </section>

      {/* Invoices (Slice 3) */}
      {invoices.length > 0 && (
        <section className="mb-6 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Invoices
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {invoices.map((inv) => (
              <li key={inv.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{inv.number}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        inv.status === "paid"
                          ? "bg-primary-soft text-primary"
                          : inv.status === "credit"
                            ? "bg-warn-soft text-warn"
                            : "bg-canvas text-muted"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums text-ink">
                    {inv.currency} {inv.total.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {inv.created_at ? formatDate(inv.created_at) : ""} ·{" "}
                  {inv.lines.map((l) => l.description).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Notification channels */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          How you&apos;re notified
        </h2>
        <form action={updateNotificationPrefs} className="mt-3 space-y-3">
          <label className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="email_notifications"
              defaultChecked={profile?.email_notifications}
              className="h-4 w-4"
            />
            Email notifications
          </label>
          <label className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="deadline_reminders"
              defaultChecked={profile?.deadline_reminders}
              className="h-4 w-4"
            />
            Deadline reminders
            <span className="text-xs text-muted">(7, 3 &amp; 1 days before)</span>
          </label>
          <label className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="digest_mode"
              defaultChecked={profile?.digest_mode}
              className="h-4 w-4"
            />
            Daily digest (one email a day, instead of one per tender)
          </label>
          <label className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="telegram_notifications"
              defaultChecked={profile?.telegram_notifications}
              className="h-4 w-4"
            />
            Telegram notifications
            <span className="text-xs text-muted">
              (connect your chat below)
            </span>
          </label>
          <SubmitButton pendingText="Saving…">Save Preferences</SubmitButton>
        </form>

        {/* Pause controls (F7) */}
        {(() => {
          const pausedUntil = profile?.notifications_paused_until
            ? new Date(profile.notifications_paused_until)
            : null;
          const isPaused = pausedUntil ? pausedUntil > new Date() : false;
          return (
            <div className="mt-4 border-t border-border pt-3">
              {isPaused ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-warn">
                    Alerts paused until {pausedUntil!.toLocaleDateString("en-GB")}.
                  </p>
                  <form action={setNotificationPause}>
                    <input type="hidden" name="days" value="0" />
                    <SubmitButton variant="ghost" className="text-primary">
                      Resume now
                    </SubmitButton>
                  </form>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span>Getting too many? Pause alerts:</span>
                  <form action={setNotificationPause}>
                    <input type="hidden" name="days" value="1" />
                    <SubmitButton variant="secondary" className="px-3">
                      24 hours
                    </SubmitButton>
                  </form>
                  <form action={setNotificationPause}>
                    <input type="hidden" name="days" value="7" />
                    <SubmitButton variant="secondary" className="px-3">
                      7 days
                    </SubmitButton>
                  </form>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* Telegram connect (F3) */}
      <section className="mt-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Telegram
        </h2>
        {profile?.telegram_chat_id ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-ink">
            <CheckIcon className="h-4 w-4 text-primary" />
            Telegram connected. Send <code className="font-mono">/stop</code> in
            the chat to unsubscribe.
          </p>
        ) : process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME && profile ? (
          <div className="mt-2">
            <p className="text-sm text-muted">
              Get instant deadline reminders in Telegram — one tap, no setup.
            </p>
            <a
              href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${profile.telegram_link_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Connect Telegram
            </a>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Telegram connect is coming soon.
          </p>
        )}
      </section>

      {/* Subscriptions */}
      <section className="mt-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Tenders you&apos;re watching
        </h2>
        <p className="mt-1 text-xs text-muted">
          {profile?.deadline_reminders
            ? "New matches arrive as they’re published; each gets 7, 3 & 1-day deadline reminders."
            : "New matches arrive as they’re published. Turn on deadline reminders above for 7/3/1-day nudges."}
        </p>

        {subs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No alerts yet. Add one below — e.g. category “Construction” in region
            “Oromia”.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {subs.map((s) => {
              const parts = [
                categoryName(s.category_id),
                s.keyword ? `“${s.keyword}”` : null,
                s.region,
              ].filter(Boolean);
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-canvas px-3 py-2 text-sm"
                >
                  <span className="text-ink">{parts.join(" · ")}</span>
                  <form action={removeSubscription}>
                    <input type="hidden" name="id" value={s.id} />
                    <SubmitButton variant="danger" className="px-3">
                      Remove
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <form
          action={addSubscription}
          className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          <select name="category_id" className={inputClass} aria-label="Category">
            <option value="">Any category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="region" className={inputClass} aria-label="Region">
            <option value="">Any region</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            name="keyword"
            type="text"
            autoComplete="off"
            placeholder="Keyword (optional)"
            className={inputClass}
            aria-label="Keyword"
          />
          <div className="sm:col-span-3">
            <SubmitButton pendingText="Adding…">Add Alert</SubmitButton>
          </div>
        </form>
      </section>
      {/* Saved tenders (F10) */}
      <section className="mt-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Saved tenders
        </h2>
        <p className="mt-1 text-xs text-muted">
          {profile?.deadline_reminders
            ? "We’ll remind you 7, 3 & 1 days before each of these closes."
            : "Turn on deadline reminders above to get 7/3/1-day nudges for these."}
        </p>
        {saved.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No saved tenders yet. Tap the “Save” button on any tender to keep it
            here.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {saved.map((t) => (
              <li key={t.id}>
                <TenderCard tender={t} showSave saved isLoggedIn />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
