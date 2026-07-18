import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// One-click email unsubscribe. The notification job (scripts/notify.py) embeds
// {APP_URL}/api/unsubscribe?token=<profiles.unsubscribe_token> in every email
// footer and in the List-Unsubscribe header.
//   GET  — a human clicking the footer link: unsubscribe, show a confirmation.
//   POST — RFC 8058 one-click (List-Unsubscribe-Post): unsubscribe, return 200.
// Unsubscribing only turns off email_notifications; Telegram is untouched and the
// user can re-enable from /account.

export const dynamic = "force-dynamic";

async function unsubscribe(token: string | null): Promise<boolean> {
  if (!token) return false;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .update({ email_notifications: false })
    .eq("unsubscribe_token", token)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

function page(title: string, body: string, status: number) {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const account = appUrl ? `${appUrl}/account` : "/account";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1.25rem;color:#111;line-height:1.5}
h1{font-size:1.25rem}a{color:#1a56db}</style></head>
<body><h1>${title}</h1><p>${body}</p>
<p><a href="${account}">Manage your notification settings</a></p></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const ok = await unsubscribe(token);
  return ok
    ? page(
        "Unsubscribed",
        "You’ll no longer receive Qellal tender emails. You can turn them back on anytime.",
        200,
      )
    : page(
        "Link not recognised",
        "This unsubscribe link is invalid or has expired. You can update your preferences from your account.",
        404,
      );
}

export async function POST(req: NextRequest) {
  // RFC 8058 one-click: mail clients POST here with the token still in the URL.
  const token = req.nextUrl.searchParams.get("token");
  const ok = await unsubscribe(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
