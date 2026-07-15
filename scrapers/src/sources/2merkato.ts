import { CheerioCrawler } from "crawlee";
import type { TenderInput } from "../lib/types";
import { toSuperSlug } from "../lib/merkato-categories";
import {
  merkatoLogin,
  cookieHeaderFor,
  UA,
  type MerkatoSession,
} from "../lib/merkato-auth";

// tender.2merkato.com is an Inertia.js (Laravel + Vue) app. The tender LIST is
// server-embedded in `<div id="app" data-page="…">`, but the category lives
// only on each tender's DETAIL page (props.tender.categories) — so we crawl:
// list page → enqueue each open tender's detail → read category + description.
// Authenticated (MERKATO_USERNAME/PASSWORD) the closing dates are visible.
// Legal: public listing metadata + attribution link; no paywalled docs.
const BASE = "https://tender.2merkato.com";
const SOURCE_NAME = "2merkato";

type NamePair = { name_en?: string | null; name?: string | null };
type RawTender = {
  id: string;
  title: string | null;
  description: string | null;
  ai_summary: string | null;
  bid_closing_date: string | null;
  published_at: string | null;
  created_at: string | null;
  company: NamePair | null;
  region: NamePair | string | null;
  categories: NamePair[] | NamePair | string | null;
  is_open: boolean;
};

function toDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function nameOf(v: NamePair | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v.trim() || null;
  return v.name_en ?? v.name ?? null;
}

// 2merkato categories can be a list, a single object, or a string. Return the
// first raw name that maps to one of our super-categories (else the first name).
function categorySlug(
  cats: NamePair[] | NamePair | string | null,
): { slug: string | null; raw: string | null } {
  const names: string[] = [];
  if (Array.isArray(cats)) {
    for (const c of cats) {
      const n = nameOf(c);
      if (n) names.push(n);
    }
  } else {
    const n = nameOf(cats);
    if (n) names.push(n);
  }
  for (const n of names) {
    const slug = toSuperSlug(n);
    if (slug) return { slug, raw: n };
  }
  return { slug: null, raw: names[0] ?? null };
}

function cleanText(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t || null;
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
  const unmapped = new Set<string>();

  const crawler = new CheerioCrawler({
    maxConcurrency: 3,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 60,
    preNavigationHooks: [
      (_ctx, gotOptions) => {
        gotOptions.headers = {
          ...gotOptions.headers,
          "User-Agent": UA,
          ...(session ? { Cookie: cookieHeaderFor(session) } : {}),
        };
      },
    ],
    async requestHandler({ $, request, log, addRequests }) {
      const raw = $("#app").attr("data-page");
      if (!raw) {
        log.warning(`no data-page at ${request.url}`);
        return;
      }
      let page: {
        props?: { tenders?: { data?: RawTender[] }; tender?: RawTender };
      };
      try {
        page = JSON.parse(raw);
      } catch {
        log.warning(`unparseable data-page JSON at ${request.url}`);
        return;
      }

      // DETAIL page: enrich the partial from userData with category + description.
      if (request.label === "detail") {
        const t = page.props?.tender;
        const base = request.userData.partial as TenderInput;
        if (t) {
          const { slug, raw: rawCat } = categorySlug(t.categories);
          if (rawCat && !slug) unmapped.add(rawCat);
          base.category_slug = slug;
          base.description =
            cleanText(t.description) ?? cleanText(t.ai_summary) ?? null;
        }
        results.push(base);
        return;
      }

      // LIST page: build a partial per open tender, then enqueue its detail.
      const list = page.props?.tenders?.data ?? [];
      log.info(`${request.url} → ${list.length} tenders`);
      const details: { url: string; label: string; userData: object }[] = [];
      for (const t of list) {
        if (t.is_open === false) continue;
        const title = t.title?.trim();
        const deadline = toDate(t.bid_closing_date);
        if (!title || !deadline) continue;

        const partial: TenderInput = {
          title,
          description: cleanText(t.description) ?? cleanText(t.ai_summary),
          region: nameOf(t.region),
          publishing_entity: nameOf(t.company),
          published_date: toDate(t.published_at ?? t.created_at),
          deadline,
          source_name: SOURCE_NAME,
          source_url: `${BASE}/tenders/${t.id}`,
          category_slug: null,
        };
        details.push({
          url: `${BASE}/tenders/${t.id}`,
          label: "detail",
          userData: { partial },
        });
      }
      await addRequests(details);
    },
    failedRequestHandler({ request, log }) {
      log.error(`request failed after retries: ${request.url}`);
    },
  });

  const urls = Array.from(
    { length: maxPages },
    (_, i) => `${BASE}/tenders?status=open&page=${i + 1}`,
  );
  await crawler.run(urls);

  if (unmapped.size > 0) {
    console.log(
      `2merkato: ${unmapped.size} category name(s) had no super-category mapping (left uncategorized): ${[...unmapped].slice(0, 15).join(", ")}`,
    );
  }
  return results;
}
