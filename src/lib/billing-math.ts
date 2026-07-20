// Pure billing math — no DB / server imports, so it's cheap to unit-test and
// safe to import anywhere. Used by invoicing (proration) and the Chapa payment
// settlement (amount validation).

// Proration: the portion of `monthly` owed/credited for the time between
// `changeDate` and `periodEnd`, relative to the full period.
export function prorate(
  monthly: number,
  changeDate: Date,
  periodStart: Date,
  periodEnd: Date,
): number {
  const total = periodEnd.getTime() - periodStart.getTime();
  const remaining = Math.max(0, periodEnd.getTime() - changeDate.getTime());
  if (total <= 0) return 0;
  return Math.round(monthly * (remaining / total) * 100) / 100;
}

// True only if the amount a gateway actually confirmed covers what we expected
// to charge (and the currency is right). Rejects UNDERpayment and wrong currency,
// but accepts an exact or OVER payment: a fee/rounding quirk or a price change
// between checkout and settlement must not deny access to someone who paid enough
// (they'd be charged but left on Free with no refund path). Overpayment is a
// support/refund concern, not an entitlement one.
export function paymentMatches(
  expected: { amount: number; currency: string },
  verified: { amount?: number; currency?: string },
): boolean {
  const exp = Number(expected.amount);
  const got = Number(verified.amount);
  // Tiny epsilon so float noise (e.g. 298.999999) doesn't read as underpayment.
  if (!Number.isFinite(got) || got < exp - 0.01) return false;
  const currency = (verified.currency ?? "ETB").toUpperCase();
  return currency === String(expected.currency).toUpperCase();
}
