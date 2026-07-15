import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSubscriptions } from "@/lib/account";
import { getCategories, getDistinctRegions } from "@/lib/tenders";
import {
  updateNotificationPrefs,
  addSubscription,
  removeSubscription,
  setNotificationPause,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your alerts — Qellal" };

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted";
const btnClass =
  "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, subs, categories, regions] = await Promise.all([
    getProfile(),
    getSubscriptions(),
    getCategories(),
    getDistinctRegions(),
  ]);

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
            <span className="text-xs text-muted">(connect coming soon)</span>
          </label>
          <button type="submit" className={btnClass}>
            Save preferences
          </button>
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
                    <button type="submit" className="text-sm font-medium text-primary hover:text-primary-hover">
                      Resume now
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span>Getting too many? Pause alerts:</span>
                  <form action={setNotificationPause}>
                    <input type="hidden" name="days" value="1" />
                    <button type="submit" className="rounded-lg border border-border px-2.5 py-1 font-medium text-ink hover:bg-primary-soft">
                      24 hours
                    </button>
                  </form>
                  <form action={setNotificationPause}>
                    <input type="hidden" name="days" value="7" />
                    <button type="submit" className="rounded-lg border border-border px-2.5 py-1 font-medium text-ink hover:bg-primary-soft">
                      7 days
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* Subscriptions */}
      <section className="mt-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Tenders you&apos;re watching
        </h2>

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
                    <button
                      type="submit"
                      className="text-xs font-medium text-urgent hover:underline"
                    >
                      Remove
                    </button>
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
            placeholder="Keyword (optional)"
            className={inputClass}
            aria-label="Keyword"
          />
          <div className="sm:col-span-3">
            <button type="submit" className={btnClass}>
              Add alert
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
