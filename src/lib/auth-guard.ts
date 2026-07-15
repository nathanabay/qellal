import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Server-only guard: ensures the caller is signed in AND has a staff/admin role.
// Redirects otherwise. Returns the client + user + role for reuse.
export async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = data?.role ?? "user";
  if (role !== "staff" && role !== "admin") redirect("/");

  return { supabase, user, role };
}
