// Chapa payment gateway client (server-only). SANDBOX/test mode. Card data and
// money movement stay with Chapa — we only initialize a hosted checkout and
// verify the result.
const CHAPA_BASE = "https://api.chapa.co/v1";

export type ChapaInitPayload = {
  amount: string;
  currency: string;
  email: string;
  first_name: string;
  last_name: string;
  tx_ref: string;
  callback_url: string;
  return_url: string;
  customization?: { title?: string; description?: string };
};

export async function initializeTransaction(
  payload: ChapaInitPayload,
): Promise<{ checkout_url: string } | null> {
  const secret = process.env.CHAPA_SECRET_KEY;
  if (!secret) return null;
  try {
    const res = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data?.status !== "success" || !data?.data?.checkout_url) {
      console.error("chapa initialize failed:", data?.message);
      return null;
    }
    return { checkout_url: data.data.checkout_url };
  } catch (e) {
    console.error("chapa initialize error:", e);
    return null;
  }
}

export async function verifyTransaction(
  txRef: string,
): Promise<{ success: boolean; amount?: number; currency?: string }> {
  const secret = process.env.CHAPA_SECRET_KEY;
  if (!secret) return { success: false };
  try {
    const res = await fetch(
      `${CHAPA_BASE}/transaction/verify/${encodeURIComponent(txRef)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const data = await res.json();
    const ok = data?.status === "success" && data?.data?.status === "success";
    return {
      success: ok,
      amount: data?.data?.amount ? Number(data.data.amount) : undefined,
      currency: data?.data?.currency ?? undefined,
    };
  } catch (e) {
    console.error("chapa verify error:", e);
    return { success: false };
  }
}
