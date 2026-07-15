import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyTransaction } from "@/lib/chapa";
import { activatePro } from "@/lib/billing-activate";

// Chapa redirects the paying user back here. We verify with Chapa (never trust
// the redirect alone) and, if paid, activate Pro using the user's own session.
export async function GET(req: NextRequest) {
  const txRef = new URL(req.url).searchParams.get("tx_ref");
  if (!txRef) return NextResponse.redirect(new URL("/account", req.url));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: payment } = await supabase
    .from("payments")
    .select("status,user_id")
    .eq("tx_ref", txRef)
    .maybeSingle();
  if (!payment || payment.user_id !== user.id)
    return NextResponse.redirect(new URL("/account", req.url));
  if (payment.status === "success")
    return NextResponse.redirect(new URL("/account?upgraded=1", req.url));

  const { success } = await verifyTransaction(txRef);
  if (success) {
    await supabase
      .from("payments")
      .update({ status: "success", paid_at: new Date().toISOString() })
      .eq("tx_ref", txRef);
    await activatePro(supabase, user.id);
    return NextResponse.redirect(new URL("/account?upgraded=1", req.url));
  }

  await supabase
    .from("payments")
    .update({ status: "failed" })
    .eq("tx_ref", txRef);
  return NextResponse.redirect(new URL("/account?payment=failed", req.url));
}
