import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily reaper (Vercel Cron, registered in vercel.json). Trials don't expire on
// their own — nothing re-evaluates a trialing row once time passes — so without
// this a 14-day trial would grant Pro forever. Flip elapsed trials to 'canceled';
// the billing_subscriptions AFTER trigger (0031) re-syncs profiles.plan to 'free'.
//
// Guarded by CRON_SECRET: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
// Fail closed — no secret set means no caller is authorized.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: "service role not configured" },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("billing_subscriptions")
    .update({
      status: "canceled",
      canceled_at: nowIso,
      cancel_at_period_end: true,
      updated_at: nowIso,
    })
    .eq("status", "trialing")
    .lte("trial_ends_at", nowIso)
    .select("user_id");

  if (error) {
    console.error("expire-trials failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, expired: data?.length ?? 0 });
}
