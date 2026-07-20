import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { generateInvoice } from "@/lib/invoicing";
import { paymentMatches } from "@/lib/billing-math";
import { PLANS } from "@/lib/plans";

// Settle a Chapa payment exactly once: validate the confirmed amount/currency,
// then atomically move the row pending -> success and activate Pro. The atomic
// `where status='pending'` update means that when the webhook and the return
// handler race for the same tx_ref, only one wins the row and activation runs
// once (no duplicate paid invoices / period resets). Caller must have already
// confirmed the payment with Chapa's /verify.
export async function settlePayment(
  admin: SupabaseClient<Database>,
  txRef: string,
  verified: { amount?: number; currency?: string },
): Promise<"activated" | "amount_mismatch" | "already_processed"> {
  const { data: payment } = await admin
    .from("payments")
    .select("user_id, amount, currency, status")
    .eq("tx_ref", txRef)
    .maybeSingle();
  if (!payment || payment.status === "success") return "already_processed";

  if (!paymentMatches({ amount: payment.amount, currency: payment.currency }, verified)) {
    await admin
      .from("payments")
      .update({ status: "failed" })
      .eq("tx_ref", txRef)
      .eq("status", "pending");
    return "amount_mismatch";
  }

  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "success", paid_at: new Date().toISOString() })
    .eq("tx_ref", txRef)
    .eq("status", "pending")
    .select("user_id")
    .maybeSingle();
  if (!claimed) return "already_processed";

  await activatePro(admin, claimed.user_id);
  return "activated";
}

// Activate Pro for a user after a successful payment. Called by settlePayment
// once the pending->success transition has been won, so it runs exactly once.
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
