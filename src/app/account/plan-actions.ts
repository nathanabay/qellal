"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BillingStatus } from "@/lib/billing";
import { generateInvoice, prorate } from "@/lib/invoicing";
import { PLANS } from "@/lib/plans";
import { initializeTransaction } from "@/lib/chapa";

// Subscription lifecycle (Chapa sandbox). Auth + ownership come from the user's
// session; every billing WRITE goes through the service-role client because RLS
// now makes billing tables read-only to end users (migration 0028) — a user must
// never be able to write their own subscription/payment/invoice state directly.
// Each write is still scoped to the authenticated user.id.

const DAY = 86_400_000;
const iso = (msFromNow = 0) => new Date(Date.now() + msFromNow).toISOString();

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function currentStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<BillingStatus | null> {
  const { data } = await supabase
    .from("billing_subscriptions")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.status as BillingStatus) ?? null;
}

export async function startTrial() {
  const { supabase, user } = await requireUser();
  const status = await currentStatus(supabase, user.id);
  // Trial only allowed with no live subscription.
  if (status && status !== "canceled") return revalidatePath("/account");

  const admin = createAdminClient();
  await admin.from("billing_subscriptions").upsert({
    user_id: user.id,
    plan_id: "pro",
    status: "trialing",
    trial_ends_at: iso(14 * DAY),
    current_period_start: iso(0),
    current_period_end: iso(14 * DAY),
    cancel_at_period_end: false,
    canceled_at: null,
    updated_at: iso(0),
  });
  await admin.from("profiles").update({ plan: "pro" }).eq("id", user.id);
  revalidatePath("/account");
}

// Real (sandbox) checkout via Chapa. Activation happens only in the return /
// webhook handler after Chapa confirms the payment — there is no test-mode
// shortcut that grants Pro without paying.
export async function checkoutPro() {
  const { user } = await requireUser();
  if (!process.env.CHAPA_SECRET_KEY) redirect("/account?payment=error");

  const admin = createAdminClient();
  const txRef = `qellal-${user.id.slice(0, 8)}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  const amount = PLANS.pro.priceEtbMonthly;
  await admin.from("payments").insert({
    user_id: user.id,
    tx_ref: txRef,
    provider: "chapa",
    plan_id: "pro",
    amount,
    currency: "ETB",
    status: "pending",
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const init = await initializeTransaction({
    amount: String(amount),
    currency: "ETB",
    email: user.email ?? "user@qellal.et",
    first_name: "Qellal",
    last_name: "Member",
    tx_ref: txRef,
    callback_url: `${appUrl}/api/chapa/webhook`,
    return_url: `${appUrl}/api/chapa/return?tx_ref=${txRef}`,
    customization: {
      title: "Qellal Pro",
      description: "Monthly Pro subscription",
    },
  });
  if (!init) redirect("/account?payment=error");
  redirect(init.checkout_url);
}

export async function pausePlan() {
  const { supabase, user } = await requireUser();
  const status = await currentStatus(supabase, user.id);
  if (status !== "active" && status !== "trialing")
    return revalidatePath("/account");
  await createAdminClient()
    .from("billing_subscriptions")
    .update({ status: "paused", updated_at: iso(0) })
    .eq("user_id", user.id);
  revalidatePath("/account");
}

export async function resumePlan() {
  const { supabase, user } = await requireUser();
  const status = await currentStatus(supabase, user.id);
  if (status !== "paused") return revalidatePath("/account");
  await createAdminClient()
    .from("billing_subscriptions")
    .update({ status: "active", updated_at: iso(0) })
    .eq("user_id", user.id);
  revalidatePath("/account");
}

export async function cancelPlan() {
  const { supabase, user } = await requireUser();
  const { data: sub } = await supabase
    .from("billing_subscriptions")
    .select("status,current_period_start,current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!sub || sub.status === "canceled") return revalidatePath("/account");

  const admin = createAdminClient();
  // Test mode: revert to Free immediately. Production: cancel at period end.
  await admin
    .from("billing_subscriptions")
    .update({
      status: "canceled",
      canceled_at: iso(0),
      cancel_at_period_end: true,
      updated_at: iso(0),
    })
    .eq("user_id", user.id);
  await admin.from("profiles").update({ plan: "free" }).eq("id", user.id);

  // Proration credit for the unused days of a paid (active) period.
  if (
    sub.status === "active" &&
    sub.current_period_start &&
    sub.current_period_end
  ) {
    const credit = prorate(
      PLANS.pro.priceEtbMonthly,
      new Date(),
      new Date(sub.current_period_start),
      new Date(sub.current_period_end),
    );
    if (credit > 0) {
      await generateInvoice(admin, user.id, {
        status: "credit",
        period_start: sub.current_period_start,
        period_end: sub.current_period_end,
        lines: [
          { description: "Proration credit — unused days", amount: -credit },
        ],
      });
    }
  }
  revalidatePath("/account");
}
