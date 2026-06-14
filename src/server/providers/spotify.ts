import { TAXONOMY } from "@/lib/taxonomy";
import { cachedPool, filterKey, isCacheableFilter } from "./cache";
import {
  type ExternalSuggestion,
  type SuggestionFilter,
  ProviderUnavailable,
  fetchJson,
  pick,
  rand,
  timeoutSignal,
  titleCase,
} from "./types";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

interface SpotifyTrack {
  id: string;
  name: string;
  preview_url: string | null;
  external_urls: { spotify: string };
  artists: { id: string; name: string }[];
  album: { release_date: string; images: { url: string }[] };
}

/**
 * The Web API returns `preview_url: null` for apps created after Nov 2024, so we
 * fall back to the public embed page, which still exposes the 30-sec preview mp3.
 */
async function resolvePreview(track: SpotifyTrack): Promise<string | null> {
  if (track.preview_url) return track.preview_url;
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${track.id}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: timeoutSignal(2500), // a best-effort scrape — don't let it stall the spin
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/"audioPreview"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/);
    return match ? match[1].replace(/\\u002F/gi, "/").replace(/\\\//g, "/") : null;
  } catch {
    return null;
  }
}

// Cache the client-credentials token in module scope until shortly before expiry.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new ProviderUnavailable("Spotify");

  if (cachedToken && cachedToken.expiresAt > Date.now() + 5_000) return cachedToken.value;

  const data = await fetchJson<{ access_token: string; expires_in: number }>(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

// Spotify caps search `limit` at 10 for apps in development mode; higher values 400.
const SEARCH_LIMIT = 10;

async function searchTracks(token: string, q: string, offset: number): Promise<SpotifyTrack[]> {
  const res = await fetch(
    `${API}/search?type=track&market=US&limit=${SEARCH_LIMIT}&offset=${offset}&q=${encodeURIComponent(q)}`,
    { ...auth(token), signal: timeoutSignal() },
  );
  if (!res.ok) return []; // sparse result / throttle → caller retries at offset 0
  const data = (await res.json()) as { tracks?: { items: SpotifyTrack[] } };
  return data.tracks?.items ?? [];
}

// Mood words → Spotify search `genre:` tags. Spotify's playlist-tracks endpoint is
// forbidden to client-credentials apps (403), so the keyword approach here maps the
// vibe to a mood tag the catalogue actually carries (verified to return on-vibe
// tracks) — unlike "sad"/"romance"/"rainy-day", which match poorly and are avoided.
const VIBE_GENRE_TAGS: Record<string, string> = {
  chill: "chill", relax: "chill", relaxing: "chill", rainy: "chill", sunday: "chill", calm: "chill", cozy: "chill", cleaning: "chill", mellow: "chill",
  energetic: "workout", energy: "workout", hype: "workout", pump: "workout", upbeat: "workout", workout: "workout", gym: "workout", running: "workout", exercise: "workout",
  focus: "study", study: "study", studying: "study", productive: "study", concentrate: "study", reading: "study",
  party: "party", dance: "party", dancing: "party", club: "party", rave: "party",
  sad: "acoustic", melancholy: "acoustic", heartbreak: "acoustic", crying: "acoustic", lonely: "acoustic", emotional: "acoustic", moody: "acoustic",
  romantic: "jazz", romance: "jazz", dinner: "jazz", date: "jazz", smooth: "jazz",
  sleep: "sleep", sleepy: "sleep", bedtime: "sleep",
  lofi: "lo-fi", "lo-fi": "lo-fi", jazz: "jazz", acoustic: "acoustic", classical: "classical", piano: "piano",
};

export function vibeGenreTag(text: string): string | null {
  const t = text.toLowerCase();
  return Object.entries(VIBE_GENRE_TAGS).find(([w]) => t.includes(w))?.[1] ?? null;
}

// Closely-related, mood-preserving tags used to widen a thin mood pool — all
// verified to return on-mood tracks under client-credentials.
export const SIBLING_TAGS: Record<string, string[]> = {
  study: ["lo-fi", "ambient"],
  "lo-fi": ["chill", "study"],
  sleep: ["ambient", "new-age"],
  acoustic: ["folk", "singer-songwriter"],
  piano: ["classical", "ambient"],
  classical: ["piano", "ambient"],
  jazz: ["soul", "lounge"],
  chill: ["lo-fi", "lounge"],
  workout: ["edm", "dance"],
  party: ["dance", "edm"],
};

const dedupeTracks = (rows: SpotifyTrack[]): SpotifyTrack[] => [...new Map(rows.map((t) => [t.id, t])).values()];

/**
 * Build a track pool for a mood tag, widening with sibling tags when the tag's own
 * catalogue is thin (e.g. "study" returns only a handful) so "Spin again" keeps moving.
 */
async function moodPool(token: string, tag: string): Promise<SpotifyTrack[]> {
  // The two pages for the tag are independent — fetch them together.
  const [a, b] = await Promise.all([
    searchTracks(token, `genre:"${tag}"`, rand(20)),
    searchTracks(token, `genre:"${tag}"`, 0),
  ]);
  let pool = dedupeTracks([...a, ...b]);
  for (const sibling of SIBLING_TAGS[tag] ?? []) {
    if (pool.length >= 15) break;
    pool = dedupeTracks([...pool, ...(await searchTracks(token, `genre:"${sibling}"`, 0))]);
  }
  return pool;
}

/** Fetch a pool of candidate tracks for the filter (cached per query). */
async function searchPool(token: string, filter?: SuggestionFilter | null): Promise<SpotifyTrack[]> {
  const free = [...(filter?.vibes ?? []), filter?.query].filter(Boolean).join(" ").trim();
  // A vibe with no explicit genre chip → steer by the mapped mood tag (the tag
  // captures the mood, so don't also title-match the descriptive text).
  const moodTag = filter?.genres?.length ? null : free ? vibeGenreTag(free) : null;
  const genre = filter?.genres?.length ? pick(filter.genres).toLowerCase() : moodTag ?? pick(TAXONOMY.MUSIC.genres).toLowerCase();

  if (moodTag) return moodPool(token, moodTag);

  // A `genre:"..."` filter gives far better relevance than a bare genre word.
  const primary = [`genre:"${genre}"`, free].filter(Boolean).join(" ");
  const fallback = free || genre; // plain text if the genre filter yields nothing
  // Random offset spreads picks across pages; degrade gracefully on overshoot/sparse.
  let items = await searchTracks(token, primary, rand(20));
  if (items.length === 0) items = await searchTracks(token, primary, 0);
  if (items.length === 0) items = await searchTracks(token, fallback, 0);
  return items;
}

/** A random track from Spotify, narrowed by the filter when present. */
export async function getRandomTrack(filter?: SuggestionFilter | null): Promise<ExternalSuggestion> {
  const token = await getToken();
  const key = isCacheableFilter(filter) ? filterKey("MUSIC", filter) : null;
  const items = await cachedPool(key, () => searchPool(token, filter));
  if (items.length === 0) throw new Error("Spotify returned no tracks");

  const track = pick(items);
  const artistId = track.artists[0]?.id;

  // The artist-genres lookup and the preview resolution are independent — run them
  // concurrently instead of one after the other.
  const [genres, previewUrl] = await Promise.all([
    artistId
      ? fetchJson<{ genres: string[] }>(`${API}/artists/${artistId}`, auth(token))
          .then((a) => a.genres.slice(0, 3).map(titleCase))
          .catch(() => [] as string[]) // genres are optional
      : Promise.resolve<string[]>([]),
    resolvePreview(track),
  ]);

  return {
    id: `spotify:${track.id}`,
    mode: "MUSIC",
    source: "spotify",
    type: null,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    year: Number(track.album.release_date?.slice(0, 4)) || null,
    rating: null,
    runtime: null,
    synopsis: null,
    genres,
    vibes: filter?.vibes ?? [],
    providers: ["Spotify"],
    url: track.external_urls.spotify,
    imageUrl: track.album.images[0]?.url ?? null,
    previewUrl,
    trailerUrl: null,
  };
}
