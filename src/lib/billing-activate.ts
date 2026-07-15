import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { generateInvoice } from "@/lib/invoicing";
import { PLANS } from "@/lib/plans";

// Activate Pro for a user after a successful payment. Called from the Chapa
// return handler (user session) and the webhook (service role). Callers must
// only invoke this when the payment was still pending (idempotency guard).
export async function activatePro(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const now = new Date();
  const periodStart = now.toISOString();
  const periodEnd = new Date(now.getTime() + 30 * 86_400_000).toISOString();

  await supabase.from("billing_subscriptions").upsert({
    user_id: userId,
    plan_id: "pro",
    status: "active",
    trial_ends_at: null,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: false,
    canceled_at: null,
    updated_at: periodStart,
  });
  await supabase.from("profiles").update({ plan: "pro" }).eq("id", userId);
  await generateInvoice(supabase, userId, {
    status: "paid",
    period_start: periodStart,
    period_end: periodEnd,
    lines: [
      {
        description: `${PLANS.pro.name} plan — 1 month`,
        amount: PLANS.pro.priceEtbMonthly,
      },
    ],
  });
}
