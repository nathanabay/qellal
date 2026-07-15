import { scrape2merkato } from "./sources/2merkato";
import { saveTenders } from "./lib/upsert";
import type { TenderInput } from "./lib/types";

// Registry of sources — one entry per source module.
const SOURCES: Record<string, (pages?: number) => Promise<TenderInput[]>> = {
  "2merkato": scrape2merkato,
};

// Usage: npm run scrape -- <source> [pages]
//   DRY_RUN=1  → extract + print, write nothing (no DB creds needed)
async function main() {
  const which = process.argv[2] ?? "2merkato";
  // Safety cap on list pages; the source auto-stops when open tenders run out.
  const pages = Number(process.argv[3] ?? 500) || 500;
  const dry = process.env.DRY_RUN === "1";

  const fn = SOURCES[which];
  if (!fn) {
    console.error(
      `unknown source "${which}". options: ${Object.keys(SOURCES).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`Scraping ${which} (pages=${pages}, dry=${dry})…`);
  const tenders = await fn(pages);
  console.log(`Extracted ${tenders.length} open tenders.`);

  if (dry) {
    console.log("\nSample (first 5):");
    console.log(JSON.stringify(tenders.slice(0, 5), null, 2));
    console.log(`\nDRY_RUN: nothing written. ${tenders.length} candidates.`);
    return;
  }

  const { inserted, skipped } = await saveTenders(tenders);
  console.log(
    `Done: ${inserted} new → review queue, ${skipped} already existed.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
