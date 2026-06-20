import { type SuggestionFilter, pickFresh } from "./types";

// In-memory candidate-pool cache. A spin with a filter (genre/vibe/description) reuses
// the pool it fetched moments ago instead of re-hitting the external API, so repeated
// "Spin again" picks are near-instant. Best-effort + per-process; pools are cheap to
// rebuild, so a cold cache or eviction just means one normal fetch.
interface Entry {
  value: unknown;
  expires: number;
}

const store = new Map<string, Entry>();
const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 200;

// Per-pool record of ids already shown, so "Spin again" exhausts the filtered pool before
// repeating. Keyed identically to the candidate cache; reset whenever a fresh pool is
// produced (see cachedPool) and cleared alongside it.
const servedStore = new Map<string, Set<string>>();

/**
 * Pick a pool item not yet shown for this filter, so every spin is a NEW result until the
 * whole filtered pool is exhausted — then a fresh cycle begins (the recent-window
 * `pickFresh` only avoided the last ~15, which repeated early on larger pools). `exclude`
 * (recent cross-session picks) is still honoured so a new cycle doesn't immediately repeat
 * the latest few. Keyless pools (pure-random "Surprise Me") keep the simple pick so they
 * stay maximally varied.
 */
export function pickUnseen<T>(
  key: string | null,
  items: readonly T[],
  id: (t: T) => string,
  exclude?: Set<string> | null,
): T {
  if (!key) return pickFresh(items, id, exclude);
  let served = servedStore.get(key);
  if (!served) {
    served = new Set<string>();
    servedStore.set(key, served);
  }
  // Prefer items neither served this cycle nor in the recent window.
  let pool = items.filter((x) => !served!.has(id(x)) && !exclude?.has(id(x)));
  if (pool.length === 0) {
    // Whole pool served (or all excluded) → start a new cycle, still skipping the recent few.
    served.clear();
    pool = items.filter((x) => !exclude?.has(id(x)));
    if (pool.length === 0) pool = [...items]; // recent covers everything → allow a repeat
  }
  const chosen = pickFresh(pool, id, null); // uniform pick within the unseen subset
  served.add(id(chosen));
  return chosen;
}

/**
 * Pure-random spins (Home "Surprise Me", no filter) stay uncached so they keep maximum
 * variety; only filtered spins — which a user repeats via "Spin again" — are cached.
 */
export function isCacheableFilter(f?: SuggestionFilter | null): boolean {
  return Boolean(
    f &&
      ((f.genres?.length ?? 0) > 0 ||
        (f.subgenres?.length ?? 0) > 0 ||
        (f.vibes?.length ?? 0) > 0 ||
        (f.query ?? "").trim() !== "" ||
        f.decade != null ||
        (f.decades?.length ?? 0) > 0 ||
        f.minRating != null ||
        (f.country ?? "") !== ""),
  );
}

/** Stable key for a (mode, filter) pair — order-insensitive for genres/vibes. */
export function filterKey(mode: string, f?: SuggestionFilter | null): string {
  const norm = {
    type: f?.type ?? "",
    genres: [...(f?.genres ?? [])].sort(),
    subgenres: [...(f?.subgenres ?? [])].sort(),
    vibes: [...(f?.vibes ?? [])].sort(),
    query: (f?.query ?? "").trim().toLowerCase(),
    // The provider receives a single resolved `decade` per spin; `decades` is kept too so
    // distinct multi-selections don't collide on the same key.
    decade: f?.decade ?? 0,
    decades: [...(f?.decades ?? [])].sort((a, b) => a - b),
    minRating: f?.minRating ?? 0,
    country: f?.country ?? "",
  };
  return `${mode}:${JSON.stringify(norm)}`;
}

/**
 * Return the cached pool for `key`, or run `produce()` and cache it. A `null` key skips
 * the cache entirely. Producer errors are NOT cached, so a failed fetch still falls
 * through to the seed pick on the next attempt.
 */
export async function cachedPool<T>(key: string | null, produce: () => Promise<T>): Promise<T> {
  if (!key) return produce();
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const value = await produce();
  // Never cache an EMPTY pool. An empty array is almost always a transient failure — most often a
  // Spotify 429 (the shared client-credentials quota is exhausted), where every search returns [].
  // Caching that would keep the spin broken for the whole TTL even after the API recovers, and a
  // custom description would show "no suggestions" until the cache expires. Let the next attempt
  // re-fetch instead. (Providers that genuinely have no results throw, and errors aren't cached.)
  if (Array.isArray(value) && value.length === 0) return value;
  if (store.size >= MAX_ENTRIES) {
    store.clear(); // simple bound — pools rebuild cheaply
    servedStore.clear();
  }
  store.set(key, { value, expires: Date.now() + TTL_MS });
  // NB: the per-key served set is intentionally NOT reset here. A pool rebuilds every TTL
  // (or on a cold process) with fresh random pages; keeping the served set across rebuilds
  // means already-shown titles aren't repeated when the new pool overlaps the old (page 1 is
  // always the most-popular slice). It only resets once the whole pool is exhausted (in
  // pickUnseen) or the cache is cleared.
  return value;
}

/** Test helper — reset between cases so cached pools/served sets don't leak across tests. */
export function clearCandidateCache(): void {
  store.clear();
  servedStore.clear();
}
