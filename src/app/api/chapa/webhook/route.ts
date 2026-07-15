import { type NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { verifyTransaction } from "@/lib/chapa";
import { activatePro } from "@/lib/billing-activate";
import { createAdminClient } from "@/lib/supabase/admin";

// Chapa POSTs here on payment completion (and failed payments, if enabled).
// Security: we ALSO re-verify every event with Chapa's /verify API before acting,
// so a spoofed request can never grant Pro. Needs SUPABASE_SERVICE_ROLE_KEY to
// write (no user session in a webhook).
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Signature check (defense in depth). Chapa signs with the webhook secret —
  // either HMAC-SHA256 of the payload (Chapa-Signature) or of the secret itself
  // (x-chapa-signature). Logged, not fatal: /verify below is the real gate.
  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (secret) {
    const sig =
      req.headers.get("chapa-signature") ??
      req.headers.get("x-chapa-signature") ??
      "";
    const bodyHmac = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");
    const secretHmac = crypto
      .createHmac("sha256", secret)
      .update(secret)
      .digest("hex");
    if (sig && sig !== bodyHmac && sig !== secretHmac) {
      console.warn("chapa webhook: signature mismatch (verifying via API anyway)");
    }
  }

  let body: { tx_ref?: string; data?: { tx_ref?: string } } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    /* empty/invalid body */
  }
  const txRef = body.tx_ref ?? body.data?.tx_ref;
  if (!txRef) return NextResponse.json({ ok: true });

  const { success } = await verifyTransaction(txRef);
  if (!success) return NextResponse.json({ ok: true });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
