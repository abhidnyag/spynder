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
  url: string | null;
  imageUrl: string | null;
  previewUrl: string | null;
  trailerUrl: string | null;
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
export const titleCase = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch + JSON with small retries for transient failures (network errors / 5xx),
 * which TMDB occasionally throws. Client errors (4xx) are not retried.
 */
export async function fetchJson<T>(url: string, init?: RequestInit, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return (await res.json()) as T;
      const error = new Error(`${url} → ${res.status} ${res.statusText}`);
      if (res.status < 500) throw error; // client error — retrying won't help
      lastError = error; // server error — retryable
    } catch (err) {
      if (err instanceof Error && /→ 4\d\d/.test(err.message)) throw err; // surface 4xx immediately
      lastError = err; // network failure — retryable
    }
    if (attempt < retries) await sleep(150 * (attempt + 1));
  }
  throw lastError;
}
