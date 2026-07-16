import { scrape2merkato } from "./sources/2merkato";
import { saveTenders, getExistingSourceUrls } from "./lib/upsert";
import type { TenderInput } from "./lib/types";

// A source scrapes and flushes batches via onBatch, returning the total flushed.
type Scraper = (
  pages: number,
  existing: Set<string>,
  onBatch: (rows: TenderInput[]) => Promise<number>,
  startPage: number,
) => Promise<number>;

const SOURCES: Record<string, Scraper> = {
  "2merkato": scrape2merkato,
};

// Usage: npm run scrape -- <source> [pages]
//   DRY_RUN=1     → extract + print, write nothing (no DB creds needed)
//   START_PAGE=N  → resume a deep backfill from list page N (default 1)
async function main() {
  const which = process.argv[2] ?? "2merkato";
  const pages = Number(process.argv[3] ?? 500) || 500;
  const startPage = Number(process.env.START_PAGE ?? 1) || 1;
  const dry = process.env.DRY_RUN === "1";

  const fn = SOURCES[which];
  if (!fn) {
    console.error(
      `unknown source "${which}". options: ${Object.keys(SOURCES).join(", ")}`,
    );
    process.exit(1);
  }

  // Load already-stored tender URLs so the scraper can skip them. Needs DB
  // creds, so only when writing for real.
  let existing = new Set<string>();
  if (!dry) {
    existing = await getExistingSourceUrls();
    console.log(`Loaded ${existing.size} existing tenders to skip.`);
  }

  // Flushed in batches DURING the crawl so a timeout still persists progress.
  let running = 0;
  let previewed = 0;
  const onBatch = async (rows: TenderInput[]): Promise<number> => {
    if (dry) {
      if (previewed < 5) {
        console.log(JSON.stringify(rows.slice(0, 5 - previewed), null, 2));
        previewed += rows.length;
      }
      return rows.length;
    }
    const { inserted } = await saveTenders(rows);
    running += inserted;
    console.log(`  …saved +${inserted} (running total ${running})`);
    return inserted;
  };

  console.log(
    `Scraping ${which} (pages=${pages}, startPage=${startPage}, dry=${dry})…`,
  );
  const total = await fn(pages, existing, onBatch, startPage);

  console.log(
    dry
      ? `DRY_RUN: nothing written. ~${total} candidates.`
      : `Done: ${total} new published.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
