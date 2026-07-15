"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth-guard";

// Staff/admin can remove any alert subscription (RLS 0007 enforces this too).
export async function adminRemoveSubscription(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) console.error("adminRemoveSubscription failed:", error.message);
  revalidatePath("/admin/subscriptions");
}
