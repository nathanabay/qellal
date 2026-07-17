// Single source of truth for how a free-text tender search behaves, shared by
// the client (open browser) and the server (archive query) so the same input
// always means the same thing.
//
// We neutralize LIKE / PostgREST metacharacters (%, _, *) plus quotes, backslash
// and parentheses rather than trying to escape them — PostgREST's ilike escaping
// is unreliable, and none of these are meaningful in a tender title search. This
// also kills the "a bare % matches everything" bug. Whitespace is collapsed and
// trimmed so leading/trailing spaces don't change results.
export function normalizeSearch(raw: string): string {
  return raw
    .replace(/[%_*\\"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Client-side match across the fields we have loaded for a card (title + buyer).
// Pass an already-normalized, lower-cased query. Description isn't loaded client-
// side (payload), so it's only searched server-side in the archive.
export function tenderMatchesSearch(
  t: { title: string; publishing_entity?: string | null },
  normalizedLowerQuery: string,
): boolean {
  if (!normalizedLowerQuery) return true;
  return `${t.title} ${t.publishing_entity ?? ""}`
    .toLowerCase()
    .includes(normalizedLowerQuery);
}

// The PostgREST `or=(...)` clause for a normalized query, matching title, buyer,
// and description. Returns null when the query is empty. Values are double-quoted
// so commas/spaces inside them don't break the or() grammar.
export function searchOrClause(normalized: string): string | null {
  if (!normalized) return null;
  const pat = `*${normalized}*`; // '*' is PostgREST's ilike wildcard
  return [
    `title.ilike."${pat}"`,
    `publishing_entity.ilike."${pat}"`,
    `description.ilike."${pat}"`,
  ].join(",");
}
