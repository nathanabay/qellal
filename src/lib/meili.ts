export type SearchParams = {
  q?: string;
  scope?: "open" | "closed" | "all";
  categoryId?: number;
  region?: string;
  deadline?: "" | "7" | "30";
  bidBond?: boolean;
  sort?: "recent" | "deadline";
  page?: number;
};

export function buildFilter(p: SearchParams, todayStart: number): string[] {
  const f: string[] = [];
  if (p.scope === "open") f.push(`deadline_ts >= ${todayStart}`);
  else if (p.scope === "closed") f.push(`deadline_ts < ${todayStart}`);
  if (p.categoryId) f.push(`category_ids = ${p.categoryId}`);
  if (p.region) f.push(`region = "${p.region.replace(/"/g, '\\"')}"`);
  if (p.bidBond) f.push(`has_bid_bond = true`);
  if (p.deadline === "7" || p.deadline === "30") {
    f.push(`deadline_ts <= ${todayStart + Number(p.deadline) * 86400}`);
  }
  return f;
}

export function buildSort(sort: "recent" | "deadline" | undefined): string[] {
  return sort === "recent"
    ? ["open_rank:asc", "published_ts:desc"]
    : ["open_rank:asc", "deadline_ts:asc"];
}
