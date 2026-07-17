import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFilter, buildSort } from "./meili";

const T = 1_752_710_400; // fixed todayStart epoch

test("open scope filters future deadlines", () => {
  assert.deepEqual(buildFilter({ scope: "open" }, T), [`deadline_ts >= ${T}`]);
});
test("closed scope filters past deadlines", () => {
  assert.deepEqual(buildFilter({ scope: "closed" }, T), [`deadline_ts < ${T}`]);
});
test("all scope + category + region + bidBond + deadline7", () => {
  assert.deepEqual(
    buildFilter({ scope: "all", categoryId: 45, region: "Oromia", bidBond: true, deadline: "7" }, T),
    [`category_ids = 45`, `region = "Oromia"`, `has_bid_bond = true`, `deadline_ts <= ${T + 7 * 86400}`],
  );
});
test("sort maps to open-first + field", () => {
  assert.deepEqual(buildSort("recent"), ["open_rank:asc", "published_ts:desc"]);
  assert.deepEqual(buildSort("deadline"), ["open_rank:asc", "deadline_ts:asc"]);
});
