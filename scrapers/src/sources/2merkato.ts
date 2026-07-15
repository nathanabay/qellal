import { CheerioCrawler } from "crawlee";
import type { TenderInput } from "../lib/types";
import {
  merkatoLogin,
  cookieHeaderFor,
  UA,
  type MerkatoSession,
} from "../lib/merkato-auth";

// tender.2merkato.com is an Inertia.js (Laravel + Vue) app that server-embeds
// its tender list in `<div id="app" data-page="…">`. With no login we only see
// the ~20% of tenders that expose a deadline publicly; authenticated as a
// subscriber, bid_closing_date is populated for all open tenders. We read
// everything we need (title, deadline, entity, region, link) from the LIST
// payload, so we never hit per-tender detail pages. Attribution link always set.
const BASE = "https://tender.2merkato.com";
const SOURCE_NAME = "2merkato";

type RawCompany = { name_en?: string | null; name?: string | null } | null;
type RawRegion =
  | { name_en?: string | null; name?: string | null }
  | string
  | null;
type RawTender = {
  id: string;
  title: string | null;
  description: string | null;
  ai_summary: string | null;
  bid_closing_date: string | null;
  published_at: string | null;
  created_at: string | null;
  company: RawCompany;
  region: RawRegion;
  is_open: boolean;
};

// "2026-07-24 17:00:00" or ISO → "2026-07-24" (or null if unparseable).
function toDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function regionName(r: RawRegion): string | null {
  if (!r) return null;
  if (typeof r === "string") return r.trim() || null;
  return r.name_en ?? r.name ?? null;
}

function companyName(c: RawCompany): string | null {
  if (!c) return null;
  return c.name_en ?? c.name ?? null;
}

export async function scrape2merkato(maxPages = 3): Promise<TenderInput[]> {
  const username = process.env.MERKATO_USERNAME;
  const password = process.env.MERKATO_PASSWORD;

  let session: MerkatoSession | null = null;
  if (username && password) {
    session = await merkatoLogin(username, password);
    console.log("2merkato: authenticated as subscriber.");
  } else {
    console.log(
      "2merkato: no MERKATO_USERNAME/PASSWORD — public tenders only (most deadlines hidden).",
    );
  }

  const results: TenderInput[] = [];
  let sawClosingDate = false;

  const crawler = new CheerioCrawler({
    maxConcurrency: 2,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 60,
    // Inject the auth cookie (and a real UA) on every request when logged in.
    preNavigationHooks: [
      (_ctx, gotOptions) => {
        gotOptions.headers = {
          ...gotOptions.headers,
          "User-Agent": UA,
          ...(session ? { Cookie: cookieHeaderFor(session) } : {}),
        };
      },
    ],
    async requestHandler({ $, request, log }) {
      const raw = $("#app").attr("data-page");
      if (!raw) {
        log.warning(`no data-page at ${request.url}`);
        return;
      }
      let page: { props?: { tenders?: { data?: RawTender[] } } };
      try {
        page = JSON.parse(raw);
      } catch {
        log.warning(`unparseable data-page JSON at ${request.url}`);
        return;
      }

      const list = page.props?.tenders?.data ?? [];
      log.info(`${request.url} → ${list.length} tenders`);

      for (const t of list) {
        if (t.is_open === false) continue;
        const title = t.title?.trim();
        const deadline = toDate(t.bid_closing_date);
        if (t.bid_closing_date) sawClosingDate = true;
        if (!title || !deadline) continue; // schema requires both

        results.push({
          title,
          description: t.description ?? t.ai_summary ?? null,
          region: regionName(t.region),
          publishing_entity: companyName(t.company),
          published_date: toDate(t.published_at ?? t.created_at),
          deadline,
          source_name: SOURCE_NAME,
          source_url: `${BASE}/tenders/${t.id}`,
        });
      }
    },
    failedRequestHandler({ request, log }) {
      log.error(`request failed after retries: ${request.url}`);
    },
  });

  // status=open keeps us to currently-open tenders; page 1 is newest-first.
  const urls = Array.from(
    { length: maxPages },
    (_, i) => `${BASE}/tenders?status=open&page=${i + 1}`,
  );
  await crawler.run(urls);

  if (session && !sawClosingDate) {
    console.warn(
      "2merkato: logged in but every closing date was still hidden — " +
        "the session may not have authenticated. Check credentials.",
    );
  }
  return results;
}
