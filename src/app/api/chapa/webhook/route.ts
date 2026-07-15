import { type NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/chapa";
import { activatePro } from "@/lib/billing-activate";
import { createAdminClient } from "@/lib/supabase/admin";

// Chapa POSTs here on payment completion (reliable path, e.g. if the user closed
// the tab). We re-verify with Chapa, then activate via the service role.
// Needs a public URL (deploy) + SUPABASE_SERVICE_ROLE_KEY to fully work.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    tx_ref?: string;
    data?: { tx_ref?: string };
  };
  const txRef = body.tx_ref ?? body.data?.tx_ref;
  if (!txRef) return NextResponse.json({ ok: true });

  const { success } = await verifyTransaction(txRef);
  if (!success) return NextResponse.json({ ok: true });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Without the service role we can't write for the user here; the return
    // handler finalizes when they land back on the site.
    return NextResponse.json({ ok: true, note: "service role not configured" });
  }

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("status,user_id")
    .eq("tx_ref", txRef)
    .maybeSingle();
  if (!payment || payment.status === "success")
    return NextResponse.json({ ok: true });

  await admin
    .from("payments")
    .update({ status: "success", paid_at: new Date().toISOString() })
    .eq("tx_ref", txRef);
  await activatePro(admin, payment.user_id);
  return NextResponse.json({ ok: true });
}
