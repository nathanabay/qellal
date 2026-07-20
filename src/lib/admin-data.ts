import { createClient } from "@/lib/supabase/server";
import { collectAllRows } from "@/lib/supabase/paginate";

// Admin data readers. RLS (0007) lets staff/admin read all rows here.
// These list the WHOLE table, so they page past the PostgREST 1000-row cap —
// otherwise the admin views silently stop at 1000 users/subscriptions.

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
  const { rows: data, error } = await collectAllRows<{
    id: string;
    email: string | null;
    full_name: string | null;
    company_name: string | null;
    role: string;
    plan: string;
    created_at: string | null;
  }>((from, to) =>
    supabase
      .from("profiles")
      .select("id,email,full_name,company_name,role,plan,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true }) // stable tiebreaker for range paging
      .range(from, to),
  );
  if (error) {
    console.error("getAllUsers failed:", error);
    return [];
  }
  return data.map((p) => ({
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
  const [subsRes, profsRes] = await Promise.all([
    collectAllRows<{
      id: string;
      user_id: string;
      category_id: number | null;
      keyword: string | null;
      region: string | null;
      created_at: string | null;
    }>((from, to) =>
      supabase
        .from("subscriptions")
        .select("id,user_id,category_id,keyword,region,created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    collectAllRows<{ id: string; email: string | null }>((from, to) =>
      supabase
        .from("profiles")
        .select("id,email")
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);
  if (subsRes.error) {
    console.error("getAllSubscriptions failed:", subsRes.error);
    return [];
  }
  const emailById = new Map(profsRes.rows.map((p) => [p.id, p.email]));
  return subsRes.rows.map((s) => ({
    id: s.id,
    email: emailById.get(s.user_id) ?? null,
    category_id: s.category_id,
    keyword: s.keyword,
    region: s.region,
    created_at: s.created_at,
  }));
}
