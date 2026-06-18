import { TAXONOMY } from "@/lib/taxonomy";
import { cachedPool, filterKey, isCacheableFilter, pickUnseen } from "./cache";
import {
  type ExternalSuggestion,
  type SuggestionFilter,
  ProviderUnavailable,
  fetchJson,
  pick,
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
 * fall back to scraping the public embed page, which still exposes the 30-sec
 * preview mp3. This scrape is the slow part of a music spin, so it's resolved
 * *lazily* by the client (via the `trackPreview` query) after the result renders
 * — the spin itself never waits on it.
 */
export async function fetchTrackPreview(trackId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: timeoutSignal(2500), // a best-effort scrape — don't let it stall
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

async function searchTracks(token: string, q: string, offset: number, market = "US"): Promise<SpotifyTrack[]> {
  const res = await fetch(
    `${API}/search?type=track&market=${market}&limit=${SEARCH_LIMIT}&offset=${offset}&q=${encodeURIComponent(q)}`,
    { ...auth(token), signal: timeoutSignal() },
  );
  // Rate limited: the client-credentials quota is shared app-wide and Spotify's
  // Retry-After can be very long (hours), so retrying would only blow the spin budget.
  // Log it — an empty pool from a 429 is a throttle, NOT "no music for this filter",
  // and silently swallowing it made country+decade spins look broken (they dead-ended
  // to the seed pick, which returns nothing for a country filter).
  if (res.status === 429) {
    console.warn(`[spotify] rate limited (429) on "${q}" [${market}] — retry-after ${res.headers.get("retry-after") ?? "?"}s`);
    return [];
  }
  if (!res.ok) return []; // sparse result / transient error → caller retries at offset 0
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
  // "party" maps to "dance" — the Spotify `genre:"party"` tag is dominated by German Ballermann/
  // Schlager party music (verified), so it returned German junk for every market; `genre:"dance"`
  // returns actual upbeat danceable pop (Michael Jackson, Zara Larsson, PinkPantheress…).
  party: "dance", dance: "dance", dancing: "dance", club: "dance", rave: "dance",
  sad: "acoustic", melancholy: "acoustic", heartbreak: "acoustic", crying: "acoustic", lonely: "acoustic", emotional: "acoustic", moody: "acoustic",
  romantic: "jazz", romance: "jazz", dinner: "jazz", date: "jazz", smooth: "jazz",
  sleep: "sleep", sleepy: "sleep", bedtime: "sleep",
  lofi: "lo-fi", "lo-fi": "lo-fi", jazz: "jazz", acoustic: "acoustic", classical: "classical", piano: "piano",
};

export function vibeGenreTag(text: string): string | null {
  const t = text.toLowerCase();
  return Object.entries(VIBE_GENRE_TAGS).find(([w]) => t.includes(w))?.[1] ?? null;
}

// Genre words a user might *type* (rather than pick as a chip) → Spotify genre tags,
// so "some rock music" steers by genre instead of title-matching the word "rock".
const MUSIC_GENRE_WORDS: Record<string, string> = {
  pop: "pop", indie: "indie", "hip hop": "hip-hop", "hip-hop": "hip-hop", hiphop: "hip-hop", rap: "hip-hop",
  rock: "rock", metal: "metal", punk: "punk", "lo-fi": "lo-fi", lofi: "lo-fi", jazz: "jazz",
  electronic: "electronic", edm: "edm", house: "house", techno: "techno", "r&b": "r-n-b", rnb: "r-n-b",
  soul: "soul", funk: "funk", country: "country", classical: "classical", piano: "piano",
  folk: "folk", reggae: "reggae", blues: "blues", "k-pop": "k-pop", kpop: "k-pop", disco: "disco",
};

export function genreFromText(text: string): string | null {
  const t = text.toLowerCase();
  return Object.entries(MUSIC_GENRE_WORDS).find(([w]) => t.includes(w))?.[1] ?? null;
}

// Filler words in a typed description that shouldn't narrow the theme search ("rainy night songs"
// → "rainy night"). Kept small — only words that add no musical meaning.
const QUERY_STOPWORDS = new Set([
  "songs", "song", "music", "track", "tracks", "playlist", "vibe", "vibes", "mood", "moods", "type",
  "some", "any", "the", "a", "an", "for", "and", "of", "to", "with", "that", "this", "want", "feel",
  "give", "play", "something", "like", "kind", "sort",
]);

/** Salient words of a free-text description (filler dropped) — used to search the description as a
 *  theme, e.g. "rainy morning songs" → ["rainy","morning"]. Empty when it's all filler. */
export function describeWords(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2 && !QUERY_STOPWORDS.has(w)))];
}

// Countries that get a local-language anchor: a free-text scene KEYWORD searched in that country's
// market (NOT a `genre:"..."` operator, which returns obscure long-tail and can't be language-
// scoped). Verified against the live Spotify API to return popular, decade-correct, local-language
// music (e.g. `bollywood year:1990-1999` → 90s Hindi hits; `k-pop year:2010-2019` → K-pop;
// `pop español …` → Spanish pop). The keyword carries the language, so the spin stays local even
// when only the market would otherwise leak international/English tracks (the vibe case especially).
// Unmapped regions (US/GB/IE) keep the generic genre+market+year search — those markets are
// English-speaking (incl. Ireland), so the international catalogue IS the local mainstream.
const COUNTRY_KEYWORD: Record<string, string> = {
  IN: "bollywood", // Hindi film music
  KR: "k-pop",
  JP: "j-pop",
  FR: "variété française",
  DE: "german pop",
  ES: "pop español",
  IT: "italian pop",
  RU: "russian pop",
  CN: "mandopop", // Mandarin pop — "c-pop" matches nothing on Spotify and falls back to English
  SE: "swedish pop",
};

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
// Pages (of SEARCH_LIMIT each) pulled per tag. A filtered spin caches this pool
// for ~5 min, so it must be comfortably larger than RECENT_WINDOW (15) or
// `pickFresh` runs out of fresh picks and starts repeating. 4 pages → up to ~40.
const POOL_PAGES = 4;

/** Fetch `pages` pages of a raw search query in parallel, de-duplicated.
 *  (Spotify dev mode caps limit at 10, so variety comes from paging.) Each page is one
 *  request fired at once, so callers blending several tags cap `pages` to keep the
 *  parallel burst small — Spotify rate-limits the shared client-credentials quota. */
async function pagedSearch(token: string, q: string, market: string, pages = POOL_PAGES): Promise<SpotifyTrack[]> {
  console.log(`Spotify search: "${q}" [${market}]`);
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) => searchTracks(token, q, i * SEARCH_LIMIT, market)),
  );
  return dedupeTracks(results.flat());
}

async function moodPool(token: string, tag: string, suffix = "", market = "US", pages = POOL_PAGES): Promise<SpotifyTrack[]> {
  // `suffix` carries an optional ` year:START-END` decade clause; `market` is the region.
  let pool = await pagedSearch(token, `genre:"${tag}"${suffix}`, market, pages);
  for (const sibling of SIBLING_TAGS[tag] ?? []) {
    if (pool.length >= 15) break;
    pool = dedupeTracks([...pool, ...(await searchTracks(token, `genre:"${sibling}"${suffix}`, 0, market))]);
  }
  return pool;
}

/**
 * A mapped country's popular, local-language pool. Searches the free-text scene `keyword` (see
 * COUNTRY_KEYWORD) in that country's market, refined by the user's vibe/genre word and scoped by
 * the decade (`year:`). Verified live to return popular, decade-correct, local-language music
 * (`bollywood sad year:2010-2019` → Hindi; `k-pop party year:2010-2019` → K-pop; …). Relaxes by
 * dropping the VIBE first (keep the decade — the user asked for the era), then the decade, so a
 * sparse combo still returns local music rather than dead-ending.
 */
async function localPool(
  token: string,
  keyword: string,
  market: string,
  filter: SuggestionFilter,
  yearSuffix: string,
): Promise<SpotifyTrack[]> {
  // Refine by the user's chip words ("sad", "rock") plus the description's mapped genre/MOOD TAG
  // word — NOT the description's raw words. Appending raw English description words to a non-
  // English keyword pulls English tracks and breaks the language anchor ("j-pop rainy night" /
  // "j-pop chill study" returned English songs); a single mapped tag ("chill"/"acoustic") keeps
  // the spin local. The keyword carries the language, so the mood just narrows within it.
  const refineWords = [...(filter.genres ?? []), ...(filter.vibes ?? [])].map((s) => s.toLowerCase());
  const desc = filter.query?.trim();
  if (desc) {
    const word = genreFromText(desc) ?? vibeGenreTag(desc);
    if (word) refineWords.push(word);
  }
  const refine = refineWords.length ? ` ${[...new Set(refineWords)].join(" ")}` : "";

  // Free-text search ranks tracks whose NAME literally contains the keyword highly, so a short
  // scene keyword surfaces junk titled after it — "j-pop"/"k-pop"/"bollywood" each returned ~⅓
  // tracks literally named "J-POP"/"K-POP"/"Bollywood" (e.g. Travis Scott's "K-POP"). Real local
  // songs have native-language names, so dropping name-contains-keyword removes the junk without
  // losing them. Normalised (no spaces/hyphens/case) so "J POP"/"J-Pop"/"jpop" all match.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const kw = norm(keyword);
  const clean = (rows: SpotifyTrack[]) => {
    const kept = rows.filter((t) => !norm(t.name).includes(kw));
    return kept.length ? kept : rows; // keep the raw pool rather than dead-end if all matched
  };

  // `${keyword}${refine}${yearSuffix}` e.g. `bollywood sad year:2010-2019` — plain text, NOT a
  // `genre:` operator (which returns obscure long-tail and breaks popularity ordering).
  const pool = async (suffix: string) => clean(await pagedSearch(token, `${keyword}${suffix}`, market, POOL_PAGES));

  // Try most-specific first, then relax: drop the vibe (keep the decade), then the decade.
  const tiers = [`${refine}${yearSuffix}`, yearSuffix, refine, ""].filter((v, i, a) => a.indexOf(v) === i);
  for (const suffix of tiers) {
    const items = await pool(suffix);
    if (items.length) return items;
  }
  return [];
}

/**
 * Fetch a pool of candidate tracks for the filter (cached per query).
 *
 * Genre/vibe **chips** resolve to `genre:"..."` tags (a chip is a precise genre/mood). A typed
 * **description**, by contrast, is searched as free text — Spotify's catalogue is full of tracks
 * and albums named for moods/themes ("rainy night", "summer vibes", "road trip"), so a direct
 * search returns thematically-relevant picks that no fixed tag captures. Any genre/mood word in
 * the description still also maps to a tag, and the two pools are blended.
 */
async function searchPool(token: string, filter?: SuggestionFilter | null): Promise<SpotifyTrack[]> {
  const free = [...(filter?.vibes ?? []), filter?.query].filter(Boolean).join(" ").trim();

  const tags: string[] = [];
  if (filter?.genres?.length) tags.push(pick(filter.genres).toLowerCase());
  if (free) {
    const textGenre = genreFromText(free); // a genre named in a chip/description
    if (textGenre) tags.push(textGenre);
    const mood = vibeGenreTag(free); // a mood named in a chip/description
    if (mood) tags.push(mood);
  }
  // De-dupe, cap at two tags to keep relevance.
  const used = [...new Set(tags)].slice(0, 2);

  // Decade → Spotify `year:` range (music has no rating, so minRating is ignored).
  const yearSuffix = filter?.decade ? ` year:${filter.decade}-${filter.decade + 9}` : "";
  // Region → Spotify market (track availability for that country).
  const market = filter?.country ?? "US";

  // A mapped country (India, Korea, Japan, France, Germany, Spain) anchors on its local-language
  // scene keyword so the spin stays local — the generic path below only sets the market, which
  // leaks international/English tracks for the vibe case (e.g. France + Sad → English acoustic).
  // Unmapped regions (US/GB/…) fall through to the generic genre+market+year search.
  const code = filter?.country?.toUpperCase();
  const keyword = code ? COUNTRY_KEYWORD[code] : undefined;
  if (filter && code && keyword) return localPool(token, keyword, code, filter, yearSuffix);

  // Genre/mood tag pools (a genre chip, plus any genre/mood word mapped from the vibes/description),
  // scoped by the decade and region.
  const tagPools = used.length
    ? dedupeTracks((await Promise.all(used.map((t) => moodPool(token, t, yearSuffix, market)))).flat())
    : [];

  // A typed description is ALSO searched directly as free text (theme matching) — its salient
  // words only ("rainy morning songs" → "rainy morning"), scoped by the decade. Blended with the
  // tag pools so a description + genre chip draws from both. Capped at 2 pages: it runs ON TOP of
  // the tag pools, and the shared Spotify client-credentials quota is easy to exhaust (429s then
  // empty every pool) — 2 pages (~20) is plenty of theme variety while keeping the burst small.
  const desc = filter?.query ? describeWords(filter.query).join(" ") : "";
  const descPool = desc ? await pagedSearch(token, `${desc}${yearSuffix}`, market, 2) : [];

  let items = dedupeTracks([...tagPools, ...descPool]);
  // Nothing resolved (no chips, and no usable description) → a random genre keeps variety.
  if (items.length === 0) items = await moodPool(token, pick(TAXONOMY.MUSIC.genres).toLowerCase(), yearSuffix, market);
  // Last resort if even that returned nothing.
  return items.length ? items : searchTracks(token, `${desc || used.join(" ")}${yearSuffix}`, 0, market);
}

/** A random track from Spotify, narrowed by the filter when present. */
export async function getRandomTrack(
  filter?: SuggestionFilter | null,
  exclude?: Set<string> | null,
): Promise<ExternalSuggestion> {
  const token = await getToken();
  const key = isCacheableFilter(filter) ? filterKey("MUSIC", filter) : null;
  const items = await cachedPool(key, () => searchPool(token, filter));
  if (items.length === 0) throw new Error("Spotify returned no tracks");

  const track = pickUnseen(key, items, (t) => `spotify:${t.id}`, exclude);
  const artistId = track.artists[0]?.id;

  // Only the artist-genres lookup is resolved up front. The 30-sec preview (a slow
  // embed scrape when the API omits `preview_url`) is fetched lazily by the client
  // after the result renders, so the spin returns fast.
  const genres = artistId
    ? await fetchJson<{ genres: string[] }>(`${API}/artists/${artistId}`, auth(token))
        .then((a) => a.genres.slice(0, 3).map(titleCase))
        .catch(() => [] as string[]) // genres are optional
    : [];

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
    previewUrl: track.preview_url, // null for newer apps → resolved lazily client-side
    trailerUrl: null,
  };
}
