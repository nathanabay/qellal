import { getPlan, type Feature } from "./plans";

// Entitlement engine — the ONLY gate for plan-restricted features.
// During the free period everything is unlocked (per PRD). When billing goes
// live, set FREE_PERIOD = false and features enforce against the plan catalog.
const FREE_PERIOD = true;

export function canAccess(plan: string, feature: Feature): boolean {
  if (FREE_PERIOD) return true;
  return getPlan(plan).features.includes(feature);
}

// Max saved alerts for a plan (null = unlimited). Enforced only when not in the
// free period.
export function subscriptionLimit(plan: string): number | null {
  if (FREE_PERIOD) return null;
  return getPlan(plan).limits.subscriptions;
}
