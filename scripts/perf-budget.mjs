#!/usr/bin/env node
// F18: performance budget guard. Run after `next build`. Fails (exit 1) if the
// client JS/CSS shipped from .next/static exceeds budget. Dep-free (fs + zlib).
//
// Metric = total gzipped client JS across all chunks + the single largest chunk
// (catches a heavy dependency) + total CSS. Per-page "First Load JS" is a subset
// of this, so staying under these keeps every route lean on 3G.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// Budgets in KB (gzipped). Current baseline ~193 KB JS / ~11 KB CSS.
const BUDGET = {
  totalJsKb: 300, // whole-app client JS
  maxChunkKb: 120, // any single chunk (a heavy dep would blow this)
  totalCssKb: 60,
};

const STATIC = ".next/static";
if (!fs.existsSync(STATIC)) {
  console.error("No .next/static — run `next build` first.");
  process.exit(1);
}

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    out = out.concat(e.isDirectory() ? walk(p) : [p]);
  }
  return out;
}

const gz = (f) => zlib.gzipSync(fs.readFileSync(f)).length;
const kb = (b) => b / 1024;

const files = walk(STATIC);
const js = files.filter((f) => f.endsWith(".js"));
const css = files.filter((f) => f.endsWith(".css"));

const totalJs = kb(js.reduce((s, f) => s + gz(f), 0));
const totalCss = kb(css.reduce((s, f) => s + gz(f), 0));
const chunks = js.map((f) => [f.replace(STATIC + "/", ""), kb(gz(f))]).sort((a, b) => b[1] - a[1]);
const maxChunk = chunks[0]?.[1] ?? 0;

const checks = [
  ["Total client JS (gz)", totalJs, BUDGET.totalJsKb],
  ["Largest single chunk (gz)", maxChunk, BUDGET.maxChunkKb],
  ["Total CSS (gz)", totalCss, BUDGET.totalCssKb],
];

let failed = false;
console.log("Performance budget (gzipped):");
for (const [label, value, budget] of checks) {
  const ok = value <= budget;
  failed = failed || !ok;
  const pct = Math.round((value / budget) * 100);
  console.log(
    `  ${ok ? "✓" : "✗"} ${label.padEnd(28)} ${value.toFixed(1).padStart(7)} KB / ${budget} KB  (${pct}%)`,
  );
}
console.log(`  largest chunk: ${chunks[0]?.[0] ?? "n/a"}`);

if (failed) {
  console.error("\nPERF BUDGET EXCEEDED — trim client JS or code-split before merging.");
  process.exit(1);
}
console.log("\nWithin budget.");
