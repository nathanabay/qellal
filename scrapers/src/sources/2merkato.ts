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
type RawSource = { name_en?: string | null; publication_date?: string | null };
type RawTender = {
  id: string;
  title: string | null;
  description: string | null;
  ai_summary: string | null;
  bid_closing_date: string | null;
  published_at: string | null;
  created_at: string | null;
  bid_bond: string | number | null;
  bid_document_price: string | number | null;
  sources: RawSource[] | null;
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

function toStr(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim() || null;
}

// "Published on": the source publication date(s), e.g. "Jul 15, 2026".
function publishedOn(sources: RawSource[] | null): string | null {
  if (!Array.isArray(sources)) return null;
  const dates = sources
    .map((s) => s.publication_date?.trim())
    .filter((d): d is string => Boolean(d));
  return dates.length ? [...new Set(dates)].join(", ") : null;
}

// maxPages is a safety cap; the crawl normally auto-stops well before it once
// open tenders run out (~300 pages). STOP_AFTER_CLOSED = how many consecutive
// all-closed pages to see before concluding there are no more open tenders.
export async function scrape2merkato(
  maxPages = 500,
  existingUrls: Set<string> = new Set(),
): Promise<TenderInput[]> {
  const STOP_AFTER_CLOSED = 5; // stop once open tenders run out
  let consecutiveClosed = 0;
  let stopped = false;
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
    // Gentle: one request at a time, ~500ms apart (120/min). 2merkato 429s
    // after bursts (~168 requests), so sequential + spaced avoids it entirely.
    maxConcurrency: 1,
    maxRequestsPerMinute: 120,
    maxRequestRetries: 5,
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
          // Detail values are more complete than the list; override.
          base.bid_bond = toStr(t.bid_bond) ?? base.bid_bond;
          base.bid_document_price =
            toStr(t.bid_document_price) ?? base.bid_document_price;
          base.published_on = publishedOn(t.sources) ?? base.published_on;
        }
        results.push(base);
        return;
      }

      // LIST page: enqueue a detail request per open tender. Tenders are
      // newest-first, so once we hit a run of all-closed pages we've passed
      // the last open tender — auto-stop instead of crawling the dead archive.
      const list = page.props?.tenders?.data ?? [];
      const pageNum = Number(
        new URL(request.url).searchParams.get("page") ?? "1",
      );
      const details: { url: string; label: string; userData: object }[] = [];
      let openOnPage = 0;
      let newOnPage = 0;
      for (const t of list) {
        if (t.is_open === false) continue;
        openOnPage++;
        const sourceUrl = `${BASE}/tenders/${t.id}`;
        if (existingUrls.has(sourceUrl)) continue; // already scraped — skip
        const title = t.title?.trim();
        const deadline = toDate(t.bid_closing_date);
        if (!title || !deadline) continue;
        newOnPage++;

        const partial: TenderInput = {
          title,
          description: cleanText(t.description) ?? cleanText(t.ai_summary),
          region: nameOf(t.region),
          publishing_entity: nameOf(t.company),
          published_date: toDate(t.published_at ?? t.created_at),
          deadline,
          source_name: SOURCE_NAME,
          source_url: sourceUrl,
          category_slug: null,
          bid_bond: toStr(t.bid_bond),
          bid_document_price: toStr(t.bid_document_price),
          published_on: publishedOn(t.sources),
        };
        details.push({ url: sourceUrl, label: "detail", userData: { partial } });
      }
      log.info(
        `page ${pageNum}: ${list.length} rows, ${openOnPage} open, ${newOnPage} new`,
      );

      consecutiveClosed = openOnPage === 0 ? consecutiveClosed + 1 : 0;
      const done = consecutiveClosed >= STOP_AFTER_CLOSED;
      if (!stopped && !done && list.length > 0 && pageNum < maxPages) {
        // Chain the next list page (keeps list pages sequential for the
        // auto-stop counter); enqueue it ahead of the detail backlog.
        await addRequests(
          [{ url: `${BASE}/tenders?status=open&page=${pageNum + 1}`, label: "list" }],
          { forefront: true },
        );
      } else if (done && !stopped) {
        stopped = true;
        log.info(`auto-stop at page ${pageNum}: reached the end of open tenders.`);
      }
      await addRequests(details);
    },
    failedRequestHandler({ request, log }) {
      log.error(`request failed after retries: ${request.url}`);
    },
  });

  // Start at page 1; each list page chains the next until open tenders run out.
  await crawler.run([`${BASE}/tenders?status=open&page=1`]);

  if (unmapped.size > 0) {
    console.log(
      `2merkato: ${unmapped.size} category name(s) had no super-category mapping (left uncategorized): ${[...unmapped].slice(0, 15).join(", ")}`,
    );
  }
  return results;
}
