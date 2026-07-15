"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BillingStatus } from "@/lib/billing";

// Test-mode subscription lifecycle state machine. No payments — in production
// upgrade/activate would run AFTER a successful gateway charge (via webhook).

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

  await supabase.from("billing_subscriptions").upsert({
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
  await supabase.from("profiles").update({ plan: "pro" }).eq("id", user.id);
  revalidatePath("/account");
}

export async function upgradeToPro() {
  const { supabase, user } = await requireUser();
  // Test mode: activate directly. Production: only after successful payment.
  await supabase.from("billing_subscriptions").upsert({
    user_id: user.id,
    plan_id: "pro",
    status: "active",
    trial_ends_at: null,
    current_period_start: iso(0),
    current_period_end: iso(30 * DAY),
    cancel_at_period_end: false,
    canceled_at: null,
    updated_at: iso(0),
  });
  await supabase.from("profiles").update({ plan: "pro" }).eq("id", user.id);
  revalidatePath("/account");
}

export async function pausePlan() {
  const { supabase, user } = await requireUser();
  const status = await currentStatus(supabase, user.id);
  if (status !== "active" && status !== "trialing")
    return revalidatePath("/account");
  await supabase
    .from("billing_subscriptions")
    .update({ status: "paused", updated_at: iso(0) })
    .eq("user_id", user.id);
  revalidatePath("/account");
}

export async function resumePlan() {
  const { supabase, user } = await requireUser();
  const status = await currentStatus(supabase, user.id);
  if (status !== "paused") return revalidatePath("/account");
  await supabase
    .from("billing_subscriptions")
    .update({ status: "active", updated_at: iso(0) })
    .eq("user_id", user.id);
  revalidatePath("/account");
}

export async function cancelPlan() {
  const { supabase, user } = await requireUser();
  const status = await currentStatus(supabase, user.id);
  if (!status || status === "canceled") return revalidatePath("/account");
  // Test mode: revert to Free immediately. Production: cancel at period end.
  await supabase
    .from("billing_subscriptions")
    .update({
      status: "canceled",
      canceled_at: iso(0),
      cancel_at_period_end: true,
      updated_at: iso(0),
    })
    .eq("user_id", user.id);
  await supabase.from("profiles").update({ plan: "free" }).eq("id", user.id);
  revalidatePath("/account");
}
