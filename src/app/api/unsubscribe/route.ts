import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// One-click email unsubscribe. The notification job (scripts/notify.py) embeds
// {APP_URL}/api/unsubscribe?token=<profiles.unsubscribe_token> in every email
// footer and in the List-Unsubscribe header.
//   GET  — a human clicking the footer link: show a CONFIRM button (does not
//          mutate). GET must be side-effect-free — mail scanners / link
//          prefetchers fetch footer URLs and would otherwise silently
//          unsubscribe the user without a click.
//   POST — RFC 8058 one-click (List-Unsubscribe-Post) AND the confirm button:
//          actually unsubscribe.
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

function page(title: string, body: string, status: number, form?: string) {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const account = appUrl ? `${appUrl}/account` : "/account";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1.25rem;color:#111;line-height:1.5}
h1{font-size:1.25rem}a{color:#1a56db}
button{font:inherit;cursor:pointer;background:#111;color:#fff;border:0;border-radius:.5rem;padding:.6rem 1rem;margin:.5rem 0}</style></head>
<body><h1>${title}</h1><p>${body}</p>
${form ?? ""}
<p><a href="${account}">Manage your notification settings</a></p></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  // Side-effect-free: only show a confirm button that POSTs. Do NOT unsubscribe
  // here — prefetchers/scanners fetch GET links without a human clicking.
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return page(
      "Link not recognised",
      "This unsubscribe link is invalid or has expired. You can update your preferences from your account.",
      404,
    );
  }
  const action = `/api/unsubscribe?token=${encodeURIComponent(token)}`;
  return page(
    "Unsubscribe from Qellal emails?",
    "Confirm to stop receiving Qellal tender emails. Telegram alerts are unaffected, and you can turn emails back on anytime.",
    200,
    `<form method="post" action="${action}"><button type="submit">Unsubscribe</button></form>`,
  );
}

export async function POST(req: NextRequest) {
  // Handles both the confirm-button form submit (browser → wants HTML) and the
  // RFC 8058 List-Unsubscribe-Post one-click (mail client → wants JSON).
  const token = req.nextUrl.searchParams.get("token");
  const ok = await unsubscribe(token);
  const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
  if (wantsHtml) {
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
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
