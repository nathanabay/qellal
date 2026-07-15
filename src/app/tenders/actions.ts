"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// F12: turn the current search/filter into a recurring alert subscription.
export async function createAlertFromSearch(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const keyword = String(formData.get("q") ?? "").trim() || null;
  const categorySlug = String(formData.get("category") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim() || null;

  let category_id: number | null = null;
  if (categorySlug) {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();
    category_id = data?.id ?? null;
  }

  // Deadline range is a browse-time filter, not an alert criterion — ignore it.
  if (!category_id && !keyword && !region) redirect("/tenders");

  await supabase
    .from("subscriptions")
    .insert({ user_id: user.id, category_id, keyword, region });

  redirect("/account");
}
