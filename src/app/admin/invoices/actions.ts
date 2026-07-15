"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";

// Admin invoice adjustment: add a line (positive charge or negative credit) and
// recompute the invoice total.
export async function adjustInvoice(formData: FormData) {
  const { supabase, role } = await requireStaff();
  if (role !== "admin") redirect("/admin");

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? "0");
  if (!invoiceId || !description || !Number.isFinite(amount) || amount === 0)
    return;

  await supabase
    .from("invoice_lines")
    .insert({ invoice_id: invoiceId, description, amount });

  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("amount")
    .eq("invoice_id", invoiceId);
  const total =
    Math.round(
      (lines ?? []).reduce((s, l) => s + Number(l.amount), 0) * 100,
    ) / 100;
  await supabase.from("invoices").update({ total }).eq("id", invoiceId);

  revalidatePath("/admin/invoices");
}
