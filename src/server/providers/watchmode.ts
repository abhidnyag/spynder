import { fetchJson, timeoutSignal } from "./types";

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
    // The `regions` query param is a paid feature — free plans 400 on any region
    // they don't have enabled. So we fetch every available region and prefer the
    // viewer's locally, which works regardless of plan.
    // No retry (the real budget-buster: a retry doubled this toward ~6s and made the
    // whole pick time out → seed → null). A 3s ceiling is plenty for Watchmode's
    // typical ~1–1.5s, so deep links resolve while staying under the spin budget.
    const sources = await fetchJson<WatchmodeSource[]>(
      `${API}/title/${kind}-${tmdbId}/sources/?apiKey=${key}`,
      { signal: timeoutSignal(3000) },
      0,
    );

    const want = region.toUpperCase();
    const inRegion = sources.filter((s) => s.region?.toUpperCase() === want);
    // Fall back to all regions when the title isn't listed in the viewer's
    // (a free plan typically only exposes its base region).
    const usable = inRegion.length ? inRegion : sources;

    // One link per service, preferring a streaming entry over a rent/buy one.
    const byName = new Map<string, { url: string; stream: boolean }>();
    for (const s of usable) {
      if (!s.web_url || !/^https?:\/\//i.test(s.web_url)) continue; // skip "paid plans only" placeholders
      const stream = STREAM_TYPES.has(s.type);
      const existing = byName.get(s.name);
      if (!existing || (stream && !existing.stream)) byName.set(s.name, { url: s.web_url, stream });
    }
    return [...byName.entries()].map(([name, { url }]) => ({ name, url }));
  } catch {
    return []; // a missing/failed lookup just means no deep links this spin
  }
}
