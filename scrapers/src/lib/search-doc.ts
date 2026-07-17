export type SearchDoc = {
  id: string;
  title: string;
  publishing_entity: string | null;
  description: string | null;
  region: string | null;
  category_ids: number[];
  has_bid_bond: boolean;
  deadline_ts: number;   // epoch seconds
  published_ts: number;  // epoch seconds
  open_rank: 0 | 1;      // 0 = open, 1 = closed
  deadline: string;
  published_on: string | null;
  source_name: string;
  bid_bond: string | null;
  posted_at: string | null;
};

type Tenderish = {
  id: string; title: string; publishing_entity?: string | null;
  description?: string | null; region?: string | null;
  category_ids?: number[]; bid_bond?: string | null; deadline: string;
  published_on?: string | null; published_date?: string | null;
  posted_at?: string | null; source_name: string;
};

const TAG = /<[^>]+>/g;

// Most-recent "Published on" date token → else posted_at → else published_date.
function publishedSeconds(t: Tenderish): number {
  const tokens = (t.published_on ?? "").match(/[A-Za-z]{3,9}\.?\s+\d{1,2},\s*\d{4}/g);
  let best = -Infinity;
  for (const tok of tokens ?? []) {
    const ms = Date.parse(tok);
    if (!Number.isNaN(ms) && ms > best) best = ms;
  }
  if (best === -Infinity && t.posted_at) {
    const ms = Date.parse(t.posted_at);
    if (!Number.isNaN(ms)) best = ms;
  }
  if (best === -Infinity && t.published_date) {
    const ms = Date.parse(t.published_date);
    if (!Number.isNaN(ms)) best = ms;
  }
  return best === -Infinity ? 0 : Math.floor(best / 1000);
}

export function toSearchDoc(t: Tenderish, now: Date): SearchDoc {
  const deadlineMs = Date.parse(t.deadline);
  const deadline_ts = Number.isNaN(deadlineMs) ? 0 : Math.floor(deadlineMs / 1000);
  const todayStart = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000,
  );
  return {
    id: t.id,
    title: t.title,
    publishing_entity: t.publishing_entity ?? null,
    description: t.description ? t.description.replace(TAG, " ").replace(/\s+/g, " ").trim() : null,
    region: t.region ?? null,
    category_ids: t.category_ids ?? [],
    has_bid_bond: Boolean(t.bid_bond),
    deadline_ts,
    published_ts: publishedSeconds(t),
    open_rank: deadline_ts >= todayStart ? 0 : 1,
    deadline: t.deadline,
    published_on: t.published_on ?? null,
    source_name: t.source_name,
    bid_bond: t.bid_bond ?? null,
    posted_at: t.posted_at ?? null,
  };
}
