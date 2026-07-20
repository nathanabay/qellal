import { type NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { verifyTransaction } from "@/lib/chapa";
import { settlePayment } from "@/lib/billing-activate";
import { createAdminClient } from "@/lib/supabase/admin";

// Chapa POSTs here on payment completion. Defense in depth:
//  1. verify the webhook signature (when CHAPA_WEBHOOK_SECRET is configured), and
//  2. re-verify the transaction with Chapa's /verify API,
// then settle the payment exactly once (amount-checked, race-safe). Needs
// SUPABASE_SERVICE_ROLE_KEY to write (no user session in a webhook).

function signatureValid(secret: string, raw: string, sig: string): boolean {
  // Chapa signs with HMAC-SHA256 of either the payload or the secret itself.
  const candidates = [
    crypto.createHmac("sha256", secret).update(raw).digest("hex"),
    crypto.createHmac("sha256", secret).update(secret).digest("hex"),
  ];
  const given = Buffer.from(sig);
  return candidates.some((c) => {
    const expected = Buffer.from(c);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // When a webhook secret is configured, REQUIRE a valid signature — reject
  // forged/unsigned requests. (If unset, we fall back to the /verify check
  // below; production must set CHAPA_WEBHOOK_SECRET.)
  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (secret) {
    const sig =
      req.headers.get("chapa-signature") ??
      req.headers.get("x-chapa-signature") ??
      "";
    if (!sig || !signatureValid(secret, raw, sig)) {
      return NextResponse.json({ ok: false }, { status: 401 });
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

  const verified = await verifyTransaction(txRef);
  // Transient/config failure (network, upstream 5xx, missing key) → 500 so Chapa
  // RETRIES rather than silently dropping a real payment. An authoritative
  // "not paid" (error unset, success false) is final → 200, no retry.
  if (verified.error) {
    return NextResponse.json({ ok: false, retry: true }, { status: 500 });
  }
  if (!verified.success) return NextResponse.json({ ok: true });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Misconfiguration, not a final state — let Chapa retry once it's fixed.
    return NextResponse.json(
      { ok: false, note: "service role not configured" },
      { status: 500 },
    );
  }

  try {
    const result = await settlePayment(createAdminClient(), txRef, verified);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("settle payment failed:", e);
    return NextResponse.json({ ok: false, retry: true }, { status: 500 });
  }
}
