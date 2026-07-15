// Dunning / collections config (config-driven). Change the schedule here.
export const DUNNING = {
  retryDays: [1, 3, 5], // days after going past_due to retry the charge
  graceDays: 7, // keep Pro access this long before downgrading
};

export type DunningSub = {
  status: string;
  current_period_end: string | null;
  past_due_since: string | null;
  dunning_attempt: number | null;
};

const DAY = 86_400_000;

// A renewal charge is due when an active subscription's period has ended.
export function isRenewalDue(sub: DunningSub, now: Date): boolean {
  return (
    sub.status === "active" &&
    !!sub.current_period_end &&
    new Date(sub.current_period_end).getTime() <= now.getTime()
  );
}

// The next collections action for a past_due subscription:
//   - past grace period      → downgrade (block Pro)
//   - due for a scheduled retry → retry the charge
//   - otherwise              → wait
export function nextDunningAction(
  sub: DunningSub,
  now: Date,
): "retry" | "downgrade" | "none" {
  if (sub.status !== "past_due" || !sub.past_due_since) return "none";
  const days = (now.getTime() - new Date(sub.past_due_since).getTime()) / DAY;
  if (days >= DUNNING.graceDays) return "downgrade";
  const attempt = sub.dunning_attempt ?? 0;
  const nextRetry = DUNNING.retryDays[attempt];
  if (nextRetry !== undefined && days >= nextRetry) return "retry";
  return "none";
}
