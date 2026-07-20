// PostgREST caps every response at 1000 rows. Any aggregate over a whole table
// (facet counts, distinct values, admin lists) must page through in chunks, or
// it silently computes over an arbitrary first-1000 subset once the table grows
// past 1000 rows. Pass a factory that applies `.range(from, to)` to an
// otherwise-fixed, STABLY-ORDERED query (order by a unique column like id, so
// chunks never skip or duplicate rows).

// `data` is intentionally `unknown` (not `T[]`): PostgREST builders for nested
// selects resolve to types the generated schema can't fully model (the
// tender_categories relation is untyped), so callers name the row type via the
// generic and we cast the batch. Mirrors the existing `as unknown` casts.
type RangeResult = { data: unknown; error: { message: string } | null };

export async function collectAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<RangeResult>,
): Promise<{ rows: T[]; error: string | null }> {
  const CHUNK = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await makeQuery(from, from + CHUNK - 1);
    if (error) return { rows, error: error.message };
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < CHUNK) break; // reached the end
  }
  return { rows, error: null };
}
