import {
  type ExternalSuggestion,
  type SuggestionFilter,
  ProviderUnavailable,
  fetchJson,
  pick,
  pickFresh,
  rand,
} from "./types";
import { cachedPool, filterKey, isCacheableFilter } from "./cache";
import { watchLinksForTmdb } from "./watchmode";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";

type Kind = "movie" | "tv";

// Our chip vocabulary → TMDB genre names (movie + tv differ for a few).
const GENRE_ALIASES: Record<string, string[]> = {
  "Sci-Fi": ["Science Fiction", "Sci-Fi & Fantasy"],
  Anime: ["Animation"],
  Action: ["Action", "Action & Adventure"],
};

interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  overview: string;
  poster_path: string | null;
}

interface TmdbVideo {
  site: string;
  type: string;
  key: string;
  official: boolean;
}

interface TmdbDetails extends TmdbResult {
  runtime?: number;
  genres: { id: number; name: string }[];
  created_by?: { name: string }[]; // series creators
  credits?: { cast?: { name: string }[]; crew?: { job: string; name: string }[] };
  "watch/providers"?: {
    results?: Record<string, { link?: string; flatrate?: { provider_name: string }[] }>;
  };
  videos?: { results: TmdbVideo[] };
}

/** Prefer an official YouTube trailer; fall back to any YouTube clip. */
function trailerFrom(details: TmdbDetails): string | null {
  const yt = details.videos?.results.filter((v) => v.site === "YouTube") ?? [];
  const best =
    yt.find((v) => v.type === "Trailer" && v.official) ?? yt.find((v) => v.type === "Trailer") ?? yt[0];
  return best ? `https://www.youtube.com/watch?v=${best.key}` : null;
}

/** Director (movies) or first creator (series); null if neither is listed. */
function directorFrom(details: TmdbDetails): string | null {
  const director = details.credits?.crew?.find((c) => c.job === "Director")?.name;
  return director ?? details.created_by?.[0]?.name ?? null;
}

function apiKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new ProviderUnavailable("TMDB");
  return key;
}

function url(path: string, params: Record<string, string | number> = {}): string {
  const qs = new URLSearchParams({ api_key: apiKey(), ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  return `${API}${path}?${qs}`;
}

// Cache the id↔name genre maps per kind (one call each, then reused).
const genreCache: Partial<Record<Kind, Map<number, string>>> = {};

async function genreMap(kind: Kind): Promise<Map<number, string>> {
  if (genreCache[kind]) return genreCache[kind]!;
  const data = await fetchJson<{ genres: { id: number; name: string }[] }>(url(`/genre/${kind}/list`));
  const map = new Map(data.genres.map((g) => [g.id, g.name]));
  genreCache[kind] = map;
  return map;
}

async function genreIds(kind: Kind, names?: string[] | null): Promise<number[]> {
  if (!names?.length) return [];
  const map = await genreMap(kind);
  const wanted = new Set(names.flatMap((n) => [n, ...(GENRE_ALIASES[n] ?? [])]).map((s) => s.toLowerCase()));
  return [...map.entries()].filter(([, name]) => wanted.has(name.toLowerCase())).map(([id]) => id);
}

const pickKind = (type?: string | null): Kind =>
  type === "series" ? "tv" : type === "movie" ? "movie" : pick<Kind>(["movie", "tv"]);

function fmtRuntime(kind: Kind, runtime?: number): string {
  if (kind === "tv") return "Series";
  if (!runtime) return "";
  return `${Math.floor(runtime / 60)}h ${runtime % 60}m`;
}

// Mood words → our genre chips, so a typed vibe also steers the genre filter.
const VIBE_GENRE_HINTS: Record<string, string> = {
  funny: "Comedy", hilarious: "Comedy", comedy: "Comedy", lighthearted: "Comedy", "feel-good": "Comedy", cozy: "Comedy",
  scary: "Horror", horror: "Horror", creepy: "Horror", spooky: "Horror",
  romantic: "Romance", romance: "Romance", love: "Romance",
  sad: "Drama", emotional: "Drama", tear: "Drama", "tear-jerker": "Drama", moving: "Drama",
  action: "Action", explosive: "Action", adventure: "Action",
  thriller: "Thriller", suspense: "Thriller", tense: "Thriller", gritty: "Thriller", "edge-of-seat": "Thriller",
  scifi: "Sci-Fi", "sci-fi": "Sci-Fi", space: "Sci-Fi", futuristic: "Sci-Fi", "mind-bending": "Sci-Fi",
  anime: "Anime",
};

// Filler words that shouldn't be looked up as TMDB keywords.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "into", "want", "something", "anything", "movie", "movies",
  "series", "show", "shows", "watch", "watching", "like", "really", "very", "some", "just", "about", "under",
  "over", "than", "then", "from", "they", "what", "when", "where", "kind", "sort", "stuff", "please", "give",
]);

export function vibeGenreHints(text: string): string[] {
  const t = text.toLowerCase();
  return [...new Set(Object.entries(VIBE_GENRE_HINTS).filter(([w]) => t.includes(w)).map(([, g]) => g))];
}

/** Resolve a free-text vibe into TMDB keyword ids (the whole phrase, then salient words). */
async function keywordIds(text: string): Promise<number[]> {
  const phrases = [text.trim(), ...text.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))].slice(0, 4);
  // Look the phrases up concurrently — sequential calls were a big latency source.
  const ids = await Promise.all(
    phrases.map((phrase) =>
      fetchJson<{ results: { id: number }[] }>(url("/search/keyword", { query: phrase, page: 1 }))
        .then((d) => d.results[0]?.id)
        .catch(() => undefined), // a keyword miss is fine — other phrases may still resolve
    ),
  );
  return [...new Set(ids.filter((id): id is number => typeof id === "number"))];
}

const dedupeById = (rows: TmdbResult[]): TmdbResult[] => [...new Map(rows.map((r) => [r.id, r])).values()];

/** Run a /discover query and return a random page's results (spreads picks around). */
async function discoverPage(kind: Kind, params: Record<string, string | number>): Promise<TmdbResult[]> {
  const first = await fetchJson<{ results: TmdbResult[]; total_pages: number }>(url(`/discover/${kind}`, { ...params, page: 1 }));
  if (first.results.length === 0) return [];
  const page = 1 + rand(Math.min(first.total_pages || 1, 20));
  if (page === 1) return first.results;
  const more = await fetchJson<{ results: TmdbResult[] }>(url(`/discover/${kind}`, { ...params, page }));
  return more.results.length > 0 ? more.results : first.results;
}

/**
 * Fetch a pool of candidate titles for the filter (cached per query). A typed
 * description is a *vibe*, not a title, so it's mapped to TMDB keywords + genres and
 * run through /discover — a title search (which only matches names) would return
 * irrelevant picks. Falls back to a popular discover when nothing resolves.
 */
async function discoverPool(filter?: SuggestionFilter | null): Promise<{ kind: Kind; results: TmdbResult[] }> {
  const kind = pickKind(filter?.type);
  const vibeText = [filter?.query, ...(filter?.vibes ?? [])].filter(Boolean).join(" ").trim();

  let results: TmdbResult[] = [];
  if (vibeText) {
    const [keywords, genres] = await Promise.all([
      keywordIds(vibeText),
      genreIds(kind, [...(filter?.genres ?? []), ...vibeGenreHints(vibeText)]),
    ]);
    const base = { sort_by: "popularity.desc", "vote_count.gte": 40, include_adult: "false" };
    if (keywords.length) {
      const withKeywords = { ...base, with_keywords: keywords.join("|") };
      results = await discoverPage(kind, genres.length ? { ...withKeywords, with_genres: genres.join(",") } : withKeywords);
      // Keyword + genre can over-narrow; widen to keywords alone for more variety.
      if (results.length < 8 && genres.length) {
        const wide = await discoverPage(kind, withKeywords);
        if (wide.length > results.length) results = wide;
      }
    }
    // Keyword tag too sparse for a satisfying re-roll → blend in on-genre picks
    // (keeps the precise matches, but gives "Spin again" room to move).
    if (results.length < 3 && genres.length) {
      const onGenre = await discoverPage(kind, { ...base, with_genres: genres.join(",") });
      results = dedupeById([...results, ...onGenre]);
    }
  }

  // No vibe given, or nothing matched: a popular discover (optionally genre-filtered).
  if (results.length === 0) {
    const genres = await genreIds(kind, filter?.genres);
    results = await discoverPage(kind, {
      sort_by: "popularity.desc",
      "vote_count.gte": 200,
      include_adult: "false",
      ...(genres.length ? { with_genres: genres.join(",") } : {}),
    });
  }
  if (results.length === 0) throw new Error("TMDB returned no results");
  return { kind, results };
}

/**
 * A random movie or series from TMDB, narrowed by the filter when present.
 * `region` is an ISO 3166-1 country code (e.g. "IN", "GB") that selects which
 * streaming services to surface; it falls back to US when the title isn't
 * listed there.
 */
export async function getRandomTitle(
  filter?: SuggestionFilter | null,
  region = "US",
  exclude?: Set<string> | null,
): Promise<ExternalSuggestion> {
  const key = isCacheableFilter(filter) ? filterKey("MOVIE", filter) : null;
  const { kind, results } = await cachedPool(key, () => discoverPool(filter));

  const chosen = pickFresh(results, (r) => `tmdb:${kind}:${r.id}`, exclude);
  // One details call (watch providers + videos + credits appended) fills runtime,
  // where-to-watch, trailer, and the director + top cast. In parallel, Watchmode
  // resolves direct per-platform deep links (no-op without WATCHMODE_API_KEY).
  const [details, watchLinks] = await Promise.all([
    fetchJson<TmdbDetails>(url(`/${kind}/${chosen.id}`, { append_to_response: "watch/providers,videos,credits" })),
    watchLinksForTmdb(chosen.id, kind, region),
  ]);

  const date = details.release_date || details.first_air_date || "";
  // Prefer the viewer's region; fall back to US so a title without local
  // listings still shows somewhere to watch.
  const watch = details["watch/providers"]?.results ?? {};
  const regional = watch[region.toUpperCase()] ?? watch.US;
  const providers = regional?.flatrate?.map((p) => p.provider_name).slice(0, 3) ?? [];
  const providerUrl = regional?.link ?? null;
  const cast = details.credits?.cast?.slice(0, 4).map((c) => c.name) ?? [];

  return {
    id: `tmdb:${kind}:${chosen.id}`,
    mode: "MOVIE",
    source: "tmdb",
    type: kind === "tv" ? "series" : "movie",
    title: details.title || details.name || "Untitled",
    artist: null,
    year: Number(date.slice(0, 4)) || null,
    rating: details.vote_average ? Math.round(details.vote_average * 10) / 10 : null,
    runtime: fmtRuntime(kind, details.runtime),
    synopsis: details.overview || null,
    genres: details.genres.map((g) => g.name).slice(0, 3),
    vibes: filter?.vibes ?? [],
    providers,
    providerUrl,
    watchLinks,
    url: `https://www.themoviedb.org/${kind}/${chosen.id}`,
    imageUrl: details.poster_path ? `${IMG}${details.poster_path}` : null,
    previewUrl: null,
    trailerUrl: trailerFrom(details),
    director: directorFrom(details),
    cast,
  };
}
