"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function updateNotificationPrefs(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      email_notifications: formData.get("email_notifications") === "on",
      telegram_notifications: formData.get("telegram_notifications") === "on",
      digest_mode: formData.get("digest_mode") === "on",
    })
    .eq("id", user.id);
  if (error) console.error("prefs update failed:", error.message);
  revalidatePath("/account");
}

export async function addSubscription(formData: FormData) {
  const { supabase, user } = await requireUser();

  const categoryRaw = String(formData.get("category_id") ?? "");
  const category_id = categoryRaw ? Number(categoryRaw) : null;
  const keyword = String(formData.get("keyword") ?? "").trim() || null;
  const region = String(formData.get("region") ?? "").trim() || null;

  // Need at least one criterion, else the alert would match everything.
  if (!category_id && !keyword && !region) return;

  const { error } = await supabase
    .from("subscriptions")
    .insert({ user_id: user.id, category_id, keyword, region });
  if (error) console.error("add subscription failed:", error.message);
  revalidatePath("/account");
}

export async function setNotificationPause(formData: FormData) {
  const { supabase, user } = await requireUser();
  const days = String(formData.get("days") ?? "");
  let until: string | null = null;
  if (days === "1") until = new Date(Date.now() + 86_400_000).toISOString();
  else if (days === "7") until = new Date(Date.now() + 7 * 86_400_000).toISOString();
  // days === "0" → resume (clear the pause)
  const { error } = await supabase
    .from("profiles")
    .update({ notifications_paused_until: until })
    .eq("id", user.id);
  if (error) console.error("pause update failed:", error.message);
  revalidatePath("/account");
}

export async function removeSubscription(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // RLS guarantees a user can only delete their own rows.
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) console.error("remove subscription failed:", error.message);
  revalidatePath("/account");
}
