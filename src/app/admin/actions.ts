"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth-guard";
import { indexTender, removeTender } from "@/lib/meili-admin";
import { toSearchDoc } from "@/lib/search-doc";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const DOC_COLS =
  "id,title,publishing_entity,description,region,bid_bond,deadline," +
  "published_on,published_date,source_name,category_id," +
  "tender_categories(category_id)";

export async function publishTender(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { error } = await supabase
    .from("tenders")
    .update({ status: "published", published_date: today() })
    .eq("id", id);
  if (error) console.error("publish failed:", error.message);

  // Add the freshly-published tender to the search index (non-fatal).
  const { data: row } = await supabase
    .from("tenders")
    .select(DOC_COLS)
    .eq("id", id)
    .maybeSingle();
  if (row) {
    const r = row as unknown as Record<string, unknown>;
    const joins = (r.tender_categories as { category_id: number }[] | null) ?? [];
    const ids = joins.map((tc) => tc.category_id);
    if (ids.length === 0 && r.category_id != null) ids.push(r.category_id as number);
    await indexTender(toSearchDoc({ ...r, category_ids: ids } as never, new Date()));
  }

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
  // Drop it from the search index (non-fatal).
  await removeTender(id);
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
  const categoryId = categoryRaw ? Number(categoryRaw) : null;
  const { data: inserted, error } = await supabase
    .from("tenders")
    .insert({
      title,
      deadline,
      source_name,
      description: String(formData.get("description") ?? "").trim() || null,
      category_id: categoryId,
      region: String(formData.get("region") ?? "").trim() || null,
      publishing_entity:
        String(formData.get("publishing_entity") ?? "").trim() || null,
      source_url: String(formData.get("source_url") ?? "").trim() || null,
      // Manual entries go to the review queue; scraped tenders auto-publish.
      status: "pending_review",
      created_by: "admin",
    })
    .select("id")
    .single();
  if (error) {
    console.error("create tender failed:", error.message);
    return;
  }
  // Mirror the chosen category into the many-to-many join so the detail page
  // chips, category filter and facet counts all include this tender.
  if (inserted && categoryId != null) {
    const { error: linkError } = await supabase
      .from("tender_categories")
      .insert({ tender_id: inserted.id, category_id: categoryId });
    if (linkError) console.error("link category failed:", linkError.message);
  }
  revalidatePath("/admin");
  revalidatePath("/tenders");
}
