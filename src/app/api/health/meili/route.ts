import { NextResponse } from "next/server";
import { meiliConfigured, searchTenders } from "@/lib/meili";

export const dynamic = "force-dynamic";

// Diagnostic: does THIS runtime see the Meili env, and can it actually reach the
// server? Turns "why is prod on the Postgres fallback?" into a one-line answer.
// Safe to expose: reveals only presence (not values) of env vars + reachability;
// the search key and data are already public via the search UI.
export async function GET() {
  const env = {
    MEILI_HOST: process.env.MEILI_HOST ? "set" : "MISSING",
    MEILI_SEARCH_KEY: process.env.MEILI_SEARCH_KEY ? "set" : "MISSING",
  };

  if (!meiliConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      env,
      diagnosis:
        "MEILI_HOST/MEILI_SEARCH_KEY are not visible to this runtime — the app never attempts Meili and uses the Postgres fallback. Fix: set them for the PRODUCTION environment in Vercel and redeploy.",
    });
  }

  const started = Date.now();
  try {
    // Typo query: Meilisearch is typo-tolerant, so a hit proves it's really Meili
    // answering (the Postgres fallback would return 0 for "constructon").
    const r = await searchTenders({ scope: "all", page: 1, q: "constructon" });
    return NextResponse.json({
      ok: true,
      configured: true,
      reachable: true,
      ms: Date.now() - started,
      total: r.total,
      typoTolerant: r.total > 0,
      diagnosis: "Meili is configured and reachable from this runtime.",
    });
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    return NextResponse.json({
      ok: false,
      configured: true,
      reachable: false,
      ms: Date.now() - started,
      error: {
        name: err?.name ?? null,
        code: err?.cause?.code ?? null,
        message: err?.message ?? String(e),
      },
      diagnosis:
        "Configured but Meili is unreachable from this runtime. ENOTFOUND=DNS, ETIMEDOUT/ECONNREFUSED=network/firewall, AbortError=timeout (raise it or the server is slow from here).",
    });
  }
}
