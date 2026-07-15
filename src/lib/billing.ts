import { createClient } from "@/lib/supabase/server";

export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled";

export type BillingSubscription = {
  user_id: string;
  plan_id: string;
  status: BillingStatus;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
};

export async function getBillingSubscription(): Promise<BillingSubscription | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select(
      "user_id,plan_id,status,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,canceled_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getBillingSubscription failed:", error.message);
    return null;
  }
  return (data as BillingSubscription | null) ?? null;
}
