"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { isRenewalDue, nextDunningAction } from "@/lib/dunning";

// Test-mode dunning processor. Renewal charges "fail", driving subscriptions
// through past_due → retries → downgrade. In production this runs on a cron and
// the charge would be a real Chapa recurring attempt via the service role.
export async function runDunning() {
  const { supabase, role } = await requireStaff();
  if (role !== "admin") redirect("/admin");
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: subs } = await supabase
    .from("billing_subscriptions")
    .select("user_id,status,current_period_end,past_due_since,dunning_attempt");

  for (const sub of subs ?? []) {
    if (isRenewalDue(sub, now)) {
      // Renewal charge attempted — test mode: it fails → go past_due.
      await supabase
        .from("billing_subscriptions")
        .update({
          status: "past_due",
          past_due_since: nowIso,
          dunning_attempt: 0,
          updated_at: nowIso,
        })
        .eq("user_id", sub.user_id);
      continue;
    }

    if (sub.status === "past_due") {
      const action = nextDunningAction(sub, now);
      if (action === "downgrade") {
        await supabase
          .from("billing_subscriptions")
          .update({
            status: "canceled",
            canceled_at: nowIso,
            updated_at: nowIso,
          })
          .eq("user_id", sub.user_id);
        await supabase
          .from("profiles")
          .update({ plan: "free" })
          .eq("id", sub.user_id);
      } else if (action === "retry") {
        // Retry charge — test mode: fails → increment the attempt counter.
        await supabase
          .from("billing_subscriptions")
          .update({
            dunning_attempt: (sub.dunning_attempt ?? 0) + 1,
            updated_at: nowIso,
          })
          .eq("user_id", sub.user_id);
      }
    }
  }
  revalidatePath("/admin/dunning");
}
