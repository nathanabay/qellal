import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type DB = SupabaseClient<Database>;

// Proration: the portion of `monthly` owed/credited for the time between
// `changeDate` and `periodEnd`, relative to the full period. Pure + testable.
export function prorate(
  monthly: number,
  changeDate: Date,
  periodStart: Date,
  periodEnd: Date,
): number {
  const total = periodEnd.getTime() - periodStart.getTime();
  const remaining = Math.max(0, periodEnd.getTime() - changeDate.getTime());
  if (total <= 0) return 0;
  return Math.round(monthly * (remaining / total) * 100) / 100;
}

export type InvoiceLineInput = { description: string; amount: number };

export async function generateInvoice(
  supabase: DB,
  userId: string,
  opts: {
    status?: string;
    lines: InvoiceLineInput[];
    period_start?: string | null;
    period_end?: string | null;
  },
): Promise<void> {
  const total =
    Math.round(opts.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const status = opts.status ?? "open";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const number = `INV-${stamp}-${globalThis.crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      number,
      status,
      total,
      period_start: opts.period_start ?? null,
      period_end: opts.period_end ?? null,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !inv) {
    console.error("generateInvoice failed:", error?.message);
    return;
  }
  const { error: le } = await supabase
    .from("invoice_lines")
    .insert(
      opts.lines.map((l) => ({
        invoice_id: inv.id,
        description: l.description,
        amount: l.amount,
      })),
    );
  if (le) console.error("invoice_lines insert failed:", le.message);
}

export type InvoiceWithLines = {
  id: string;
  number: string;
  status: string;
  currency: string;
  total: number;
  period_start: string | null;
  period_end: string | null;
  created_at: string | null;
  lines: { description: string; amount: number }[];
};

export async function getUserInvoices(): Promise<InvoiceWithLines[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id,number,status,currency,total,period_start,period_end,created_at",
    )
    .order("created_at", { ascending: false });
  const inv = invoices ?? [];
  if (inv.length === 0) return [];

  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("invoice_id,description,amount")
    .in(
      "invoice_id",
      inv.map((i) => i.id),
    );
  const byInvoice = new Map<string, { description: string; amount: number }[]>();
  for (const l of lines ?? []) {
    const arr = byInvoice.get(l.invoice_id) ?? [];
    arr.push({ description: l.description, amount: Number(l.amount) });
    byInvoice.set(l.invoice_id, arr);
  }
  return inv.map((i) => ({
    ...i,
    total: Number(i.total),
    lines: byInvoice.get(i.id) ?? [],
  }));
}

export type AdminInvoice = {
  id: string;
  email: string | null;
  number: string;
  status: string;
  total: number;
  created_at: string | null;
};

export async function getAllInvoices(): Promise<AdminInvoice[]> {
  const supabase = await createClient();
  const [{ data: invoices }, { data: profs }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id,user_id,number,status,total,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,email"),
  ]);
  const emailById = new Map((profs ?? []).map((p) => [p.id, p.email]));
  return (invoices ?? []).map((i) => ({
    id: i.id,
    email: emailById.get(i.user_id) ?? null,
    number: i.number,
    status: i.status,
    total: Number(i.total),
    created_at: i.created_at,
  }));
}
