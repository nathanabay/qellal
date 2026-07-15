"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import type { UserRole } from "@/lib/supabase/database.types";

// Only admins manage users. RLS (0007) also enforces this at the DB level.
export async function updateUser(formData: FormData) {
  const { supabase, user, role } = await requireStaff();
  if (role !== "admin") redirect("/admin");

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const newRole = String(formData.get("role") ?? "");
  const newPlan = String(formData.get("plan") ?? "");

  const patch: { role?: UserRole; plan?: string } = {};
  if (["user", "staff", "admin"].includes(newRole)) {
    // Lockout guard: an admin can't demote their own account below admin.
    if (!(id === user.id && newRole !== "admin")) patch.role = newRole as UserRole;
  }
  if (["free", "pro"].includes(newPlan)) patch.plan = newPlan;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) console.error("updateUser failed:", error.message);
  }
  revalidatePath("/admin/users");
}
