// Config-driven plan catalog (Catalog Management). Pricing/features live HERE as
// configuration, not hard-coded in components — change a plan by editing this file.
// NOTE: no payment processing. Prices are display-only until a real gateway
// (Chapa/Telebirr) is connected in a later slice. Amounts are Ethiopian Birr.

export type PlanId = "free" | "pro";

export type Feature =
  | "email_alerts"
  | "telegram_alerts"
  | "instant_alerts"
  | "unlimited_subscriptions"
  | "priority_support";

export type Plan = {
  id: PlanId;
  name: string;
  priceEtbMonthly: number; // 0 = free
  description: string;
  features: Feature[];
  limits: { subscriptions: number | null }; // null = unlimited
};

export const FEATURE_LABELS: Record<Feature, string> = {
  email_alerts: "Email deadline alerts",
  telegram_alerts: "Telegram alerts",
  instant_alerts: "Instant alerts (vs daily digest)",
  unlimited_subscriptions: "Unlimited saved alerts",
  priority_support: "Priority support",
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceEtbMonthly: 0,
    description: "Everything you need to never miss a deadline.",
    features: ["email_alerts", "telegram_alerts"],
    limits: { subscriptions: 5 },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceEtbMonthly: 299,
    description: "For teams tracking many opportunities at once.",
    features: [
      "email_alerts",
      "telegram_alerts",
      "instant_alerts",
      "unlimited_subscriptions",
      "priority_support",
    ],
    limits: { subscriptions: null },
  },
};

export const PLAN_LIST: Plan[] = [PLANS.free, PLANS.pro];

export function getPlan(id: string): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "free"];
}
