"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth-guard";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function publishTender(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase
    .from("tenders")
    .update({ status: "published", published_date: today() })
    .eq("id", id);
  if (error) console.error("publish failed:", error.message);
  revalidatePath("/admin");
  revalidatePath("/tenders");
}

export async function rejectTender(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase
    .from("tenders")
    .update({ status: "rejected" })
    .eq("id", id);
  if (error) console.error("reject failed:", error.message);
  revalidatePath("/admin");
}

// Manual entry by staff publishes directly (trusted source).
export async function createTender(formData: FormData) {
  const { supabase } = await requireStaff();

  const title = String(formData.get("title") ?? "").trim();
  const deadline = String(formData.get("deadline") ?? "");
  const source_name = String(formData.get("source_name") ?? "").trim();
  // Required fields — the form enforces these too, but guard server-side.
  if (!title || !deadline || !source_name) return;

  const categoryRaw = String(formData.get("category_id") ?? "");
  const { error } = await supabase.from("tenders").insert({
    title,
    deadline,
    source_name,
    description: String(formData.get("description") ?? "").trim() || null,
    category_id: categoryRaw ? Number(categoryRaw) : null,
    region: String(formData.get("region") ?? "").trim() || null,
    publishing_entity:
      String(formData.get("publishing_entity") ?? "").trim() || null,
    source_url: String(formData.get("source_url") ?? "").trim() || null,
    // Manual entries go to the review queue; scraped tenders auto-publish.
    status: "pending_review",
    created_by: "admin",
  });
  if (error) console.error("create tender failed:", error.message);
  revalidatePath("/admin");
  revalidatePath("/tenders");
}
