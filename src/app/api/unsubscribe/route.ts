import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// One-click email unsubscribe. The `token` is the user's per-profile
// telegram_link_token (a secret uuid already on profiles) — no auth session is
// available when a mail client calls this. Turns OFF email alerts only; Telegram
// is managed separately via /stop.
async function unsubscribe(token: string): Promise<boolean> {
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ email_notifications: false })
    .eq("telegram_link_token", token)
    .select("id")
    .maybeSingle();
  return !error && Boolean(data);
}

// RFC 8058 one-click: mail clients POST here with body `List-Unsubscribe=One-Click`.
// The confirmation-page form also POSTs, with redirect=1 so the human sees a page.
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  await unsubscribe(token);
  if (req.nextUrl.searchParams.get("redirect") === "1") {
    return NextResponse.redirect(
      new URL(`/api/unsubscribe?token=${encodeURIComponent(token)}&done=1`, req.url),
      303,
    );
  }
  return new NextResponse(null, { status: 200 });
}

// A human clicking the link gets a confirmation page with a button that POSTs —
// GET has no side effect, so mail-scanner link prefetching can't unsubscribe them.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const done = req.nextUrl.searchParams.get("done") === "1";
  const page = (title: string, msg: string, form: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Qellal</title>
<style>body{font-family:system-ui,sans-serif;background:#F4F1EA;color:#17140D;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#fff;border:1px solid #e5e1d8;border-radius:16px;padding:32px;
max-width:420px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#6b665c}
button,a.btn{display:inline-block;margin-top:16px;background:#17140D;color:#F4F1EA;
border:0;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:600;
cursor:pointer;text-decoration:none}a.link{color:#8a5a2b}</style></head>
<body><div class="card"><h1>${title}</h1><p>${msg}</p>${form}</div></body></html>`;

  if (done) {
    return new NextResponse(
      page(
        "Unsubscribed",
        "You won’t receive email alerts anymore. You can re-enable them anytime.",
        `<a class="btn" href="/account">Manage alerts</a>`,
      ),
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
  return new NextResponse(
    page(
      "Unsubscribe from email alerts?",
      "Stop receiving Qellal tender alerts by email.",
      `<form method="post" action="/api/unsubscribe?token=${encodeURIComponent(token)}&redirect=1">
         <button type="submit">Unsubscribe</button>
       </form>
       <p style="margin-top:16px"><a class="link" href="/account">Manage preferences instead</a></p>`,
    ),
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
