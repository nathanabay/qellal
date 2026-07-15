import { createClient } from "@/lib/supabase/server";

// Admin data readers. RLS (0007) lets staff/admin read all rows here.

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  role: string;
  plan: string;
  created_at: string | null;
};

export async function getAllUsers(): Promise<AdminUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,company_name,role,plan,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllUsers failed:", error.message);
    return [];
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    company_name: p.company_name,
    role: p.role,
    plan: p.plan,
    created_at: p.created_at,
  }));
}

export type AdminSubscription = {
  id: string;
  email: string | null;
  category_id: number | null;
  keyword: string | null;
  region: string | null;
  created_at: string | null;
};

export async function getAllSubscriptions(): Promise<AdminSubscription[]> {
  const supabase = await createClient();
  const [{ data: subs, error }, { data: profs }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id,user_id,category_id,keyword,region,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,email"),
  ]);
  if (error) {
    console.error("getAllSubscriptions failed:", error.message);
    return [];
  }
  const emailById = new Map((profs ?? []).map((p) => [p.id, p.email]));
  return (subs ?? []).map((s) => ({
    id: s.id,
    email: emailById.get(s.user_id) ?? null,
    category_id: s.category_id,
    keyword: s.keyword,
    region: s.region,
    created_at: s.created_at,
  }));
}
