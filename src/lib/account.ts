import { createClient } from "@/lib/supabase/server";

// Read helpers for the signed-in user's profile + subscriptions.
// RLS scopes every query to the current user, so no explicit user filter needed.

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  email_notifications: boolean;
  telegram_notifications: boolean;
  digest_mode: boolean;
  deadline_reminders: boolean;
  notifications_paused_until: string | null;
  telegram_chat_id: string | null;
  telegram_link_token: string;
};

export type Subscription = {
  id: string;
  category_id: number | null;
  keyword: string | null;
  region: string | null;
};

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,full_name,company_name,email_notifications,telegram_notifications,digest_mode,deadline_reminders,notifications_paused_until,telegram_chat_id,telegram_link_token",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("profile fetch failed:", error.message);
    return null;
  }

  return {
    id: data.id,
    email: user.email ?? null,
    full_name: data.full_name,
    company_name: data.company_name,
    email_notifications: data.email_notifications ?? true,
    telegram_notifications: data.telegram_notifications ?? false,
    digest_mode: data.digest_mode ?? true,
    deadline_reminders: data.deadline_reminders ?? true,
    notifications_paused_until: data.notifications_paused_until,
    telegram_chat_id: data.telegram_chat_id,
    telegram_link_token: data.telegram_link_token,
  };
}

export async function getSubscriptions(): Promise<Subscription[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id,category_id,keyword,region")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("subscriptions fetch failed:", error.message);
    return [];
  }
  return data ?? [];
}
