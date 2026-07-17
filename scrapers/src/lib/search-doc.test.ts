import { test } from "node:test";
import assert from "node:assert/strict";
import { toSearchDoc } from "./search-doc";

const base = {
  id: "a1b2", title: "Road works", publishing_entity: "ERA",
  description: "<p>Build a <b>bridge</b></p>", region: "Oromia",
  category_ids: [37, 28], bid_bond: "10,000", deadline: "2026-07-20",
  published_on: "Jul 16, 2026", published_date: "2026-07-16",
  posted_at: "2026-07-16T09:00:00.000Z", source_name: "2merkato",
};

test("maps fields, strips html, derives flags/timestamps", () => {
  const now = new Date("2026-07-17T00:00:00.000Z");
  const d = toSearchDoc(base, now);
  assert.equal(d.id, "a1b2");
  assert.equal(d.description, "Build a bridge");       // html stripped
  assert.deepEqual(d.category_ids, [37, 28]);
  assert.equal(d.has_bid_bond, true);
  assert.equal(d.deadline_ts, Date.parse("2026-07-20") / 1000);
  assert.equal(d.published_ts, Date.parse("Jul 16, 2026") / 1000);
  assert.equal(d.open_rank, 0);                        // deadline in future
});

test("closed tender gets open_rank 1", () => {
  const now = new Date("2026-07-21T00:00:00.000Z");
  assert.equal(toSearchDoc(base, now).open_rank, 1);
});

test("no bid bond → has_bid_bond false", () => {
  const now = new Date("2026-07-17T00:00:00.000Z");
  assert.equal(toSearchDoc({ ...base, bid_bond: null }, now).has_bid_bond, false);
});
