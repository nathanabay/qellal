import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Telegram sends bot updates here. Register with:
//   setWebhook?url=<APP_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
// Handles /start <token> (link this chat to a Qellal account) and /stop (unsubscribe).

type TgUpdate = {
  message?: { text?: string; chat?: { id?: number } };
};

async function reply(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function POST(req: NextRequest) {
  // Verify the request really came from Telegram (secret set at webhook
  // registration). Fail CLOSED: with no secret configured the endpoint would be
  // fully unauthenticated, so a missing secret is a hard reject, not a skip —
  // otherwise anyone could POST forged /stop updates for an enumerable chat_id.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    !secret ||
    req.headers.get("x-telegram-bot-api-secret-token") !== secret
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await req.json().catch(() => ({}))) as TgUpdate;
  const text = update.message?.text ?? "";
  const chatId = update.message?.chat?.id;
  if (typeof chatId !== "number") return NextResponse.json({ ok: true });

  // Can't process without the service role key — ack so Telegram stops retrying.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: true });
  const supabase = createAdminClient();

  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    if (!token) {
      await reply(
        chatId,
        "Welcome to Qellal. Open the “Connect Telegram” link from your account to link this chat.",
      );
    } else {
      const { data } = await supabase
        .from("profiles")
        .update({
          telegram_chat_id: String(chatId),
          telegram_notifications: true,
          // Rotate the one-tap link token so a leaked connect link can't be
          // replayed to bind a different chat to this account.
          telegram_link_token: globalThis.crypto.randomUUID(),
        })
        .eq("telegram_link_token", token)
        .select("id")
        .maybeSingle();
      await reply(
        chatId,
        data
          ? "✅ Connected! You’ll get Qellal tender alerts here. Send /stop anytime to unsubscribe."
          : "That link wasn’t recognised. Open the connect link from your Qellal account again.",
      );
    }
  } else if (text.startsWith("/stop")) {
    await supabase
      .from("profiles")
      .update({ telegram_notifications: false, telegram_chat_id: null })
      .eq("telegram_chat_id", String(chatId));
    await reply(
      chatId,
      "🔕 Unsubscribed from Telegram alerts. Re-connect anytime from your Qellal account.",
    );
  }

  return NextResponse.json({ ok: true });
}
