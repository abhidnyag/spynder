import type { SuggestionFilter } from "./types";

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

/**
 * Pure-random spins (Home "Surprise Me", no filter) stay uncached so they keep maximum
 * variety; only filtered spins — which a user repeats via "Spin again" — are cached.
 */
export function isCacheableFilter(f?: SuggestionFilter | null): boolean {
  return Boolean(
    f &&
      ((f.genres?.length ?? 0) > 0 ||
        (f.vibes?.length ?? 0) > 0 ||
        (f.query ?? "").trim() !== "" ||
        f.decade != null ||
        f.minRating != null ||
        (f.country ?? "") !== ""),
  );
}

/** Stable key for a (mode, filter) pair — order-insensitive for genres/vibes. */
export function filterKey(mode: string, f?: SuggestionFilter | null): string {
  const norm = {
    type: f?.type ?? "",
    genres: [...(f?.genres ?? [])].sort(),
    vibes: [...(f?.vibes ?? [])].sort(),
    query: (f?.query ?? "").trim().toLowerCase(),
    decade: f?.decade ?? 0,
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
  if (store.size >= MAX_ENTRIES) store.clear(); // simple bound — pools rebuild cheaply
  store.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Test helper — reset between cases so cached pools don't leak across tests. */
export function clearCandidateCache(): void {
  store.clear();
}
