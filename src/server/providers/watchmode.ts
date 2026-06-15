import { fetchJson } from "./types";

// Watchmode turns a title into direct, per-platform deep links (the exact page
// on Netflix/Prime/etc.), which TMDB's watch/providers does not expose.
const API = "https://api.watchmode.com/v1";

// Subscription/free streams map to TMDB's "flatrate" chips; rent/buy are a
// weaker match, so we only use them when a service has no streaming entry.
const STREAM_TYPES = new Set(["sub", "free"]);

interface WatchmodeSource {
  source_id: number;
  name: string;
  type: string; // "sub" | "free" | "rent" | "buy" | "tva"
  region: string;
  web_url: string;
}

export interface WatchLink {
  name: string;
  url: string;
}

/**
 * Direct deep links into each streaming platform for a TMDB title, for the
 * viewer's region. Watchmode accepts a TMDB id directly as `movie-<id>` /
 * `tv-<id>`, so no separate id lookup is needed.
 *
 * Returns `[]` when `WATCHMODE_API_KEY` is unset or the call fails, so the
 * suggestion path degrades gracefully to plain provider labels — matching how
 * every other external lookup here fails soft.
 */
export async function watchLinksForTmdb(
  tmdbId: number,
  kind: "movie" | "tv",
  region = "US",
): Promise<WatchLink[]> {
  const key = process.env.WATCHMODE_API_KEY;
  if (!key) return [];
  try {
    const sources = await fetchJson<WatchmodeSource[]>(
      `${API}/title/${kind}-${tmdbId}/sources/?apiKey=${key}&regions=${region.toUpperCase()}`,
    );
    // One link per service, preferring a streaming entry over a rent/buy one.
    const byName = new Map<string, { url: string; stream: boolean }>();
    for (const s of sources) {
      if (!s.web_url) continue;
      const stream = STREAM_TYPES.has(s.type);
      const existing = byName.get(s.name);
      if (!existing || (stream && !existing.stream)) byName.set(s.name, { url: s.web_url, stream });
    }
    return [...byName.entries()].map(([name, { url }]) => ({ name, url }));
  } catch {
    return []; // a missing/failed lookup just means no deep links this spin
  }
}
