import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/chapa";
import { settlePayment } from "@/lib/billing-activate";

// Chapa redirects the paying user back here. We check ownership with the user's
// session, re-verify with Chapa (never trust the redirect alone), then settle
// the payment via the service role (amount-checked + exactly-once, shared with
// the webhook). Billing tables are read-only to users under RLS, so writes must
// use the admin client.
export async function GET(req: NextRequest) {
  const txRef = new URL(req.url).searchParams.get("tx_ref");
  if (!txRef) return NextResponse.redirect(new URL("/account", req.url));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  // Ownership check on the user's own session (RLS select).
  const { data: payment } = await supabase
    .from("payments")
    .select("status,user_id")
    .eq("tx_ref", txRef)
    .maybeSingle();
  if (!payment || payment.user_id !== user.id)
    return NextResponse.redirect(new URL("/account", req.url));
  if (payment.status === "success")
    return NextResponse.redirect(new URL("/account?upgraded=1", req.url));

  const verified = await verifyTransaction(txRef);
  if (!verified.success) {
    await createAdminClient()
      .from("payments")
      .update({ status: "failed" })
      .eq("tx_ref", txRef)
      .eq("status", "pending");
    return NextResponse.redirect(new URL("/account?payment=failed", req.url));
  }

  const result = await settlePayment(createAdminClient(), txRef, verified);
  const dest =
    result === "amount_mismatch" ? "/account?payment=failed" : "/account?upgraded=1";
  return NextResponse.redirect(new URL(dest, req.url));
}
