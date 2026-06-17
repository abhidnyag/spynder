import {
  type ExternalSuggestion,
  type SuggestionFilter,
  ProviderUnavailable,
  fetchJson,
  pick,
  rand,
} from "./types";
import { cachedPool, filterKey, isCacheableFilter, pickUnseen } from "./cache";
import { watchLinksForTmdb } from "./watchmode";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";

type Kind = "movie" | "tv";

// Our chip vocabulary → TMDB genre names (movie + tv differ for a few). These are
// DIRECT equivalents that exist on one side or the other, applied to both kinds.
const GENRE_ALIASES: Record<string, string[]> = {
  "Sci-Fi": ["Science Fiction", "Sci-Fi & Fantasy"],
  Anime: ["Animation"],
  Action: ["Action", "Action & Adventure"],
};

// LOOSE, TV-only approximations for chips TMDB's TV catalogue has no exact genre for
// (no "Thriller"/"Horror"/"Romance" on the TV side). Applied ONLY when querying series
// and ONLY in "loose" mode — so movie genre resolution is never broadened (Crime/Mystery
// are real movie genres, so mixing these into movie queries would change behaviour).
// Used as a best-effort fallback for a pinned "Series" + one of these genres.
const TV_GENRE_FALLBACKS: Record<string, string[]> = {
  Thriller: ["Crime", "Mystery"], // crime/mystery thrillers
  Horror: ["Mystery", "Sci-Fi & Fantasy"], // psychological & supernatural horror
  Romance: ["Soap", "Drama"], // romantic serials / dramas
};

// Region → that country's primary film/TV language (ISO 639-1), the movies/series
// analogue of music's COUNTRY_GENRES (Bollywood/filmi …). Added to /discover as
// `with_original_language` ON TOP of `with_origin_country`, so a region pick is
// authentically native — India → Hindi (Bollywood), Korea → Korean, Japan → Japanese —
// rather than an English-language co-production merely shot or co-funded there. The
// constraint is dropped (origin country alone) when it over-narrows a sparse era — see
// `discoverPool`. US/GB stay unmapped: English is the default and origin country already
// pins them.
const COUNTRY_LANGUAGES: Record<string, string> = {
  IN: "hi", // Hindi — Bollywood, India's largest industry
  KR: "ko", // Korean
  JP: "ja", // Japanese
  FR: "fr", // French
  ES: "es", // Spanish
  DE: "de", // German
  RU: "ru", // Russian
  IT: "it", // Italian
  CN: "zh", // Chinese
  SE: "sv", // Swedish
  // IE (Ireland) stays unmapped — Irish film/TV is English.
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

/** Test helper — reset the per-kind genre map cache so cases don't leak maps. */
export function clearGenreCache(): void {
  delete genreCache.movie;
  delete genreCache.tv;
}

async function genreMap(kind: Kind): Promise<Map<number, string>> {
  if (genreCache[kind]) return genreCache[kind]!;
  const data = await fetchJson<{ genres: { id: number; name: string }[] }>(url(`/genre/${kind}/list`));
  const map = new Map(data.genres.map((g) => [g.id, g.name]));
  genreCache[kind] = map;
  return map;
}

/**
 * TMDB genre ids for our chip names. `loose` adds the TV-only approximations
 * (Thriller→Crime/Mystery, …) when querying series, so a pinned "Series" + Thriller
 * spin still filters by something. It's OFF for the kind-steering decision, which must
 * stay strict (a genre that maps only via a loose TV fallback shouldn't count as "TV
 * supports it"), and a no-op for movies (the fallbacks are TV-side only).
 */
async function genreIds(kind: Kind, names?: string[] | null, loose = false): Promise<number[]> {
  if (!names?.length) return [];
  const map = await genreMap(kind);
  const fallbacks = loose && kind === "tv" ? TV_GENRE_FALLBACKS : {};
  const wanted = new Set(
    names.flatMap((n) => [n, ...(GENRE_ALIASES[n] ?? []), ...(fallbacks[n] ?? [])]).map((s) => s.toLowerCase()),
  );
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

/**
 * Pool several pages of a /discover query (page 1 + a few random pages) for far more
 * variety on re-rolls. A single page (~20) is cached for 5 min, so "Spin again" would
 * just cycle those 20 even when the catalogue has hundreds (e.g. a country + decade).
 * `count` pages → up to ~`count * 20` candidates; 5 keeps re-rolls fresh deep into a
 * session while staying well within TMDB's rate budget (pages fetch in parallel, once
 * per cache miss). Capped by the catalogue's own page count for a thin filter.
 */
async function discoverPages(kind: Kind, params: Record<string, string | number>, count = 5): Promise<TmdbResult[]> {
  console.log("kind, params", kind, params);
  const first = await fetchJson<{ results: TmdbResult[]; total_pages: number }>(url(`/discover/${kind}`, { ...params, page: 1 }));
  if (first.results.length === 0) return [];
  const maxPage = Math.min(first.total_pages || 1, 20);
  // Distinct random pages beyond page 1 (page 1 holds the most popular titles).
  const extra = new Set<number>();
  while (extra.size < Math.min(count - 1, maxPage - 1)) extra.add(2 + rand(maxPage - 1));
  const more = await Promise.all(
    [...extra].map((p) =>
      fetchJson<{ results: TmdbResult[] }>(url(`/discover/${kind}`, { ...params, page: p }))
        .then((d) => d.results)
        .catch(() => [] as TmdbResult[]),
    ),
  );
  return dedupeById([...first.results, ...more.flat()]);
}

/**
 * Fetch a pool of candidate titles for the filter (cached per query). A typed
 * description is a *vibe*, not a title, so it's mapped to TMDB keywords + genres and
 * run through /discover — a title search (which only matches names) would return
 * irrelevant picks. Falls back to a popular discover when nothing resolves.
 */
async function discoverPool(filter?: SuggestionFilter | null): Promise<{ kind: Kind; results: TmdbResult[] }> {
  const vibeText = [filter?.query, ...(filter?.vibes ?? [])].filter(Boolean).join(" ").trim();

  // Decade → release-date window (the date field differs for movies vs series);
  // minRating → vote_average floor; country → origin country (+ native language). Built
  // per-kind so the popular fallback can retry the other kind with the correct date field.
  const constraintsFor = (k: Kind, includeLang = true, includeRating = true): Record<string, string | number> => {
    const dateKey = k === "tv" ? "first_air_date" : "primary_release_date";
    const c: Record<string, string | number> = {};
    if (filter?.decade) {
      c[`${dateKey}.gte`] = `${filter.decade}-01-01`;
      c[`${dateKey}.lte`] = `${filter.decade + 9}-12-31`;
    }
    if (includeRating && filter?.minRating) c["vote_average.gte"] = filter.minRating;
    if (filter?.country) {
      const code = filter.country.toUpperCase();
      c["with_origin_country"] = code;
      // Native-language refinement (Hindi for India, Korean for Korea, …). Dropped via
      // includeLang=false when it leaves too few titles, so a country spin still works.
      const lang = includeLang ? COUNTRY_LANGUAGES[code] : undefined;
      if (lang) c["with_original_language"] = lang;
    }
    return c;
  };

  // Small regional/older catalogues rarely clear 200 votes (e.g. German 90s series), so relax
  // the popularity floor for those. But the big English markets (US/GB) ARE the mainstream
  // catalogue — a low floor there lets obscure junk through (low-vote series, adult anthologies
  // mis-tagged "sci-fi"), so keep them at the high floor like a no-country spin. A thin US+genre
  // +decade combo still relaxes via grow() below.
  const bigMarket = filter?.country ? ["US", "GB"].includes(filter.country.toUpperCase()) : false;
  const voteFloor = !filter?.country || bigMarket ? 200 : 20;
  const typePinned = filter?.type === "movie" || filter?.type === "series";

  // A selected genre may exist for only ONE kind — TMDB's TV genre list has no
  // Thriller/Horror/Romance, so a "series" pick would silently drop the genre and return
  // off-genre shows. Resolve which kinds can actually honour the genre up front, so we can
  // (a) steer an unpinned spin to a kind that supports it and (b) never switch away to a
  // kind that can't. No genre, or one supported by both kinds → null (no constraint).
  let genreKind: Kind | null = null;
  if (filter?.genres?.length) {
    const [movieG, tvG] = await Promise.all([genreIds("movie", filter.genres), genreIds("tv", filter.genres)]);
    if (movieG.length && !tvG.length) genreKind = "movie";
    else if (tvG.length && !movieG.length) genreKind = "tv";
  }

  // Honour a pinned type; otherwise prefer the genre-supporting kind, else random.
  const kind = typePinned ? pickKind(filter?.type) : (genreKind ?? pickKind(filter?.type));
  const constraints = constraintsFor(kind);

  let results: TmdbResult[] = [];
  if (vibeText) {
    const [keywords, genres] = await Promise.all([
      keywordIds(vibeText),
      genreIds(kind, [...(filter?.genres ?? []), ...vibeGenreHints(vibeText)], true),
    ]);
    const base = { sort_by: "popularity.desc", "vote_count.gte": filter?.country ? 20 : 40, include_adult: "false", ...constraints };
    if (keywords.length) {
      const withKeywords = { ...base, with_keywords: keywords.join("|") };
      // Multi-page so a vibe/genre spin has a big, varied pool (not one ~20 page).
      results = await discoverPages(kind, genres.length ? { ...withKeywords, with_genres: genres.join(",") } : withKeywords);
      // Keyword + genre can over-narrow; widen to keywords alone for more variety.
      if (results.length < 8 && genres.length) {
        const wide = await discoverPages(kind, withKeywords);
        if (wide.length > results.length) results = wide;
      }
    }
    // Keyword tag too sparse for a satisfying re-roll → blend in on-genre picks
    // (keeps the precise matches, but gives "Spin again" room to move).
    if (results.length < 8 && genres.length) {
      const onGenre = await discoverPages(kind, { ...base, with_genres: genres.join(",") });
      results = dedupeById([...results, ...onGenre]);
    }
  }

  // No vibe given, or nothing matched: a popular discover (optionally genre-filtered).
  // Below this many candidates, "Spin again" starts repeating — the service skips the
  // last RECENT_WINDOW (15) picks, so a smaller pool quickly runs out of fresh titles.
  const MIN_POOL = 20;
  const langForCountry = filter?.country ? COUNTRY_LANGUAGES[filter.country.toUpperCase()] : undefined;

  // A discover for one kind at a given vote floor (and optional language/rating). Sorted by
  // popularity by default; the rating-drop fallback sorts by rating to surface the best available.
  const discoverPopular = async (
    k: Kind,
    voteGte: number,
    includeLang = true,
    includeRating = true,
    sort = "popularity.desc",
  ): Promise<TmdbResult[]> => {
    const genres = await genreIds(k, filter?.genres, true); // loose: series gets a TV approximation
    const withGenres: Record<string, string> = genres.length ? { with_genres: genres.join(",") } : {};
    return discoverPages(k, { sort_by: sort, include_adult: "false", "vote_count.gte": voteGte, ...withGenres, ...constraintsFor(k, includeLang, includeRating) });
  };

  // Grow a thin country pool, PRESERVING country + language as long as possible:
  //   1) relax the popularity floor — old/regional films rarely clear 20 votes, but ≥5
  //      keeps real titles while dropping untrusted 0–4-vote noise (turns ~5 into ~50);
  //   2) only for a genuinely tiny catalogue, drop the language as a last resort so the
  //      spin still returns titles rather than cycling the same handful.
  // Relaxed vote floor when growing a thin pool. For small regional catalogues a handful of
  // votes is all a real title has, so ≥5. But in the big US/GB markets ≥5 surfaces unreliable
  // ratings — a movie "★10" from 5 voters, parody shorts, making-of docs — which is glaring once
  // a rating filter is set; keep a meaningful floor there so the rating stays trustworthy.
  const relaxedFloor = bigMarket ? 50 : 5;
  const grow = async (k: Kind, pool: TmdbResult[]): Promise<TmdbResult[]> => {
    let res = pool;
    if (res.length < MIN_POOL && filter?.country) {
      const lower = await discoverPopular(k, relaxedFloor);
      if (lower.length > res.length) res = lower;
      if (res.length < MIN_POOL && langForCountry) {
        const noLang = await discoverPopular(k, relaxedFloor, false);
        if (noLang.length > res.length) res = noLang;
      }
      // Only when NOTHING clears the rating (e.g. US horror movies of the 2000s rated 8+ barely
      // exist) drop it as a last resort, returning real well-voted titles of the genre/decade/
      // country (Dawn of the Dead…) instead of junk or a dead-end. If even a handful match the
      // rating, keep them — the user asked for that rating, so don't dilute it with lower picks.
      if (res.length === 0 && filter?.minRating) {
        // Sort by rating so we surface the BEST-rated available (Dawn of the Dead ★7.1), the
        // closest thing to the rating they wanted — not just any popular low-rated title.
        res = await discoverPopular(k, relaxedFloor, langForCountry ? false : true, false, "vote_average.desc");
      }
    }
    return res;
  };

  let resolvedKind = kind;
  if (results.length === 0) {
    results = await discoverPopular(kind, voteFloor);
    // movie vs series is chosen at random, but the two catalogues differ wildly in size
    // (e.g. Indian 1990s: ~88 films but only ~7 series even fully relaxed). When the
    // random kind is thin and the type isn't pinned, compare the other kind AT THE SAME
    // FLOOR and keep the richer one — done BEFORE any relaxation, so a tiny TV pool isn't
    // first inflated to "good enough" and then locked in, which made re-spins cycle ~3–4.
    // Skip when a genre locked the kind: switching would silently drop the genre (the
    // other kind can't map it), trading a thin on-genre pool for a large off-genre one.
    if (!typePinned && !genreKind && results.length < MIN_POOL) {
      const other: Kind = kind === "tv" ? "movie" : "tv";
      const otherResults = await discoverPopular(other, voteFloor);
      if (otherResults.length > results.length) {
        results = otherResults;
        resolvedKind = other;
      }
    }
    // Grow whichever kind we settled on, if it's still thin for an older/regional decade.
    results = await grow(resolvedKind, results);
  }
  if (results.length === 0) throw new Error("TMDB returned no results");
  return { kind: resolvedKind, results };
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

  const chosen = pickUnseen(key, results, (r) => `tmdb:${kind}:${r.id}`, exclude);
  // One details call (watch providers + videos + credits appended) fills runtime,
  // where-to-watch, trailer, and the director + top cast. In parallel, Watchmode
  // resolves direct per-platform deep links (no-op without WATCHMODE_API_KEY).
  //
  // The details call must NOT be allowed to dead-end the spin: TMDB 429s (rate limit) or
  // times out occasionally, and `fetchJson` surfaces a 4xx immediately. Throwing here sent
  // the whole pick to the seed fallback — which returns NOTHING for a country filter — so a
  // single hiccup mid-session showed "no more results" even though the pool was full. The
  // discover row we already picked carries title/poster/year/rating/overview, so on failure
  // we degrade to that (just without runtime/cast/trailer) and the spin keeps flowing.
  const [details, watchLinks] = await Promise.all([
    fetchJson<TmdbDetails>(url(`/${kind}/${chosen.id}`, { append_to_response: "watch/providers,videos,credits" })).catch(() => null),
    watchLinksForTmdb(chosen.id, kind, region),
  ]);

  const base = details ?? chosen;
  const date = base.release_date || base.first_air_date || "";
  // Prefer the viewer's region; fall back to US so a title without local
  // listings still shows somewhere to watch.
  const watch = details?.["watch/providers"]?.results ?? {};
  const regional = watch[region.toUpperCase()] ?? watch.US;
  const providers = regional?.flatrate?.map((p) => p.provider_name).slice(0, 3) ?? [];
  const providerUrl = regional?.link ?? null;
  const cast = details?.credits?.cast?.slice(0, 4).map((c) => c.name) ?? [];

  return {
    id: `tmdb:${kind}:${chosen.id}`,
    mode: "MOVIE",
    source: "tmdb",
    type: kind === "tv" ? "series" : "movie",
    title: base.title || base.name || "Untitled",
    artist: null,
    year: Number(date.slice(0, 4)) || null,
    rating: base.vote_average ? Math.round(base.vote_average * 10) / 10 : null,
    runtime: fmtRuntime(kind, details?.runtime),
    synopsis: base.overview || null,
    genres: details?.genres?.map((g) => g.name).slice(0, 3) ?? [],
    vibes: filter?.vibes ?? [],
    providers,
    providerUrl,
    watchLinks,
    url: `https://www.themoviedb.org/${kind}/${chosen.id}`,
    imageUrl: base.poster_path ? `${IMG}${base.poster_path}` : null,
    previewUrl: null,
    trailerUrl: details ? trailerFrom(details) : null,
    director: details ? directorFrom(details) : null,
    cast,
  };
}
