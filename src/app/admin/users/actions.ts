"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import type { Database, UserRole } from "@/lib/supabase/database.types";

type BillingInsert =
  Database["public"]["Tables"]["billing_subscriptions"]["Insert"];

// Only admins manage users. RLS (0007) also enforces this at the DB level.
export async function updateUser(formData: FormData) {
  const { supabase, user, role } = await requireStaff();
  if (role !== "admin") redirect("/admin");

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const newRole = String(formData.get("role") ?? "");
  const newPlan = String(formData.get("plan") ?? "");

  // Role lives on profiles (0027 lets only admins/service change it).
  if (["user", "staff", "admin"].includes(newRole)) {
    // Lockout guard: an admin can't demote their own account below admin.
    if (!(id === user.id && newRole !== "admin")) {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole as UserRole })
        .eq("id", id);
      if (error) console.error("updateUser role failed:", error.message);
    }
  }

  // Plan is derived from billing_subscriptions (single source of truth, 0030) —
  // drive it through billing so profiles.plan can't drift from the billing state.
  if (["free", "pro"].includes(newPlan)) {
    const now = new Date();
    const row: BillingInsert =
      newPlan === "pro"
        ? {
            user_id: id,
            plan_id: "pro",
            status: "active",
            trial_ends_at: null,
            current_period_start: now.toISOString(),
            current_period_end: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
            cancel_at_period_end: false,
            canceled_at: null,
            updated_at: now.toISOString(),
          }
        : {
            user_id: id,
            plan_id: "free",
            status: "canceled",
            canceled_at: now.toISOString(),
            updated_at: now.toISOString(),
          };
    const { error } = await supabase.from("billing_subscriptions").upsert(row);
    if (error) console.error("updateUser plan failed:", error.message);
  }
  revalidatePath("/admin/users");
}
