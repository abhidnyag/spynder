import type { SuggestionFilter } from "@/server/services/suggestion.service";

/** Shape every external catalogue normalises to — mirrors the Suggestion model. */
export interface ExternalSuggestion {
  id: string; // stable external id, e.g. "spotify:<id>" / "tmdb:movie:<id>" / "openlib:<id>"
  mode: "MUSIC" | "MOVIE" | "BOOK";
  source: "spotify" | "tmdb" | "open_library";
  type: string | null;
  title: string;
  artist: string | null;
  year: number | null;
  rating: number | null;
  runtime: string | null;
  synopsis: string | null;
  genres: string[];
  vibes: string[];
  providers: string[];
  // Where-to-watch link for the providers (region-specific); null when none applies.
  providerUrl?: string | null;
  // Direct per-platform deep links (movies/series via Watchmode); empty when none.
  watchLinks?: { name: string; url: string }[];
  url: string | null;
  imageUrl: string | null;
  previewUrl: string | null;
  trailerUrl: string | null;
  // Movies/series only — shown on the result, fetched per pick (not persisted).
  director?: string | null;
  cast?: string[];
}

export type { SuggestionFilter };

/** Raised when an API's credentials are absent — signals a graceful fallback. */
export class ProviderUnavailable extends Error {
  constructor(provider: string) {
    super(`${provider} is not configured`);
    this.name = "ProviderUnavailable";
  }
}

/* ----------------------------- shared helpers ----------------------------- */
export const rand = (n: number) => Math.floor(Math.random() * n);
export const pick = <T>(arr: readonly T[]): T => arr[rand(arr.length)];

/**
 * Random element whose id isn't in `exclude` (recently-shown picks), so spins
 * don't repeat until the pool is genuinely exhausted. Falls back to the full
 * list when everything is excluded — the "not enough data" case.
 */
export const pickFresh = <T>(arr: readonly T[], id: (t: T) => string, exclude?: Set<string> | null): T => {
  if (exclude?.size) {
    const fresh = arr.filter((x) => !exclude.has(id(x)));
    if (fresh.length) return fresh[rand(fresh.length)];
  }
  return arr[rand(arr.length)];
};
export const titleCase = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A slow external API is the main source of suggestion latency, so every request is
// time-boxed: a hung call aborts fast and the service falls back to the seed catalogue.
export const FETCH_TIMEOUT_MS = 3000;
export const timeoutSignal = (ms: number = FETCH_TIMEOUT_MS): AbortSignal => AbortSignal.timeout(ms);

/** Reject `promise` if it outlives `ms` — bounds total provider time per spin. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`operation timed out after ${ms}ms`)), ms)),
  ]);
}

/**
 * fetch + JSON, time-boxed, with one retry for transient failures (network errors /
 * 5xx / timeouts), which TMDB occasionally throws. Client errors (4xx) are not retried.
 */
export async function fetchJson<T>(url: string, init?: RequestInit, retries = 1): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: init?.signal ?? timeoutSignal() });
      if (res.ok) return (await res.json()) as T;
      const error = new Error(`${url} → ${res.status} ${res.statusText}`);
      if (res.status < 500) throw error; // client error — retrying won't help
      lastError = error; // server error — retryable
    } catch (err) {
      if (err instanceof Error && /→ 4\d\d/.test(err.message)) throw err; // surface 4xx immediately
      lastError = err; // network failure / timeout — retryable
    }
    if (attempt < retries) await sleep(120 * (attempt + 1));
  }
  throw lastError;
}
