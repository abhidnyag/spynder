import type { Mode, PrismaClient, Suggestion } from "@prisma/client";
import { getRandomTrack, fetchTrackPreview } from "@/server/providers/spotify";
import { getRandomTitle } from "@/server/providers/tmdb";
import { getRandomBook } from "@/server/providers/books";
import { ProviderUnavailable, withTimeout, type ExternalSuggestion } from "@/server/providers/types";

export interface SuggestionFilter {
  type?: string | null;
  genres?: string[] | null;
  subgenres?: string[] | null;
  vibes?: string[] | null;
  query?: string | null;
  /** Start years of the chosen decades; any of them may match. */
  decades?: number[] | null;
  /** Deprecated single-decade form, still honoured when sent. */
  decade?: number | null;
  minRating?: number | null;
  country?: string | null;
}

/** The decades to honour, folding the legacy single `decade` into the multi-select array. */
export function selectedDecades(filter?: SuggestionFilter | null): number[] {
  if (filter?.decades?.length) return filter.decades;
  return filter?.decade != null ? [filter.decade] : [];
}

/**
 * Collapse the decade selection to the single `decade` field the live providers read (each
 * takes one year range). The UI stores decades in the `decades` array — even a single pick —
 * so this must resolve for ANY non-empty selection, not just multi-select, or the year filter
 * is silently dropped. With several decades a random one is chosen per fetch, so successive
 * spins span the whole set. No-op only when no decade is selected.
 */
export function withProviderDecade(filter?: SuggestionFilter | null): SuggestionFilter | null | undefined {
  const decades = selectedDecades(filter);
  if (!decades.length) return filter;
  return { ...filter, decade: decades[Math.floor(Math.random() * decades.length)] };
}

/**
 * Lazily resolve a Spotify track's 30-sec preview (scraped after the spin so the
 * result appears fast). Returns null for non-Spotify ids or when none is found.
 */
export async function getTrackPreview(suggestionId: string): Promise<string | null> {
  const m = /^spotify:(.+)$/.exec(suggestionId);
  return m ? fetchTrackPreview(m[1]) : null;
}

/** Normalise a Prisma row's JSON columns into plain string arrays for GraphQL. */
export function toSuggestionDTO(s: Suggestion) {
  return {
    ...s,
    genres: (s.genres as string[]) ?? [],
    vibes: (s.vibes as string[]) ?? [],
    providers: (s.providers as string[]) ?? [],
    watchLinks: (s.watchLinks as { name: string; url: string }[]) ?? [],
    cast: (s.cast as string[]) ?? [],
  };
}

const overlaps = (have: unknown, want?: string[] | null) =>
  !want?.length || (have as string[]).some((g) => want.includes(g));

const matchesText = (s: Suggestion, query?: string | null) => {
  if (!query?.trim()) return true;
  const haystack = [s.title, s.artist, s.synopsis, ...(s.genres as string[]), ...(s.vibes as string[])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .some((w) => haystack.includes(w));
};

/** Cache an external pick into MySQL so history (FK) and the DB fallback stay valid. */
async function persist(prisma: PrismaClient, ext: ExternalSuggestion, userId: string | null) {
  const data = {
    mode: ext.mode as Mode,
    source: ext.source,
    type: ext.type,
    title: ext.title,
    artist: ext.artist,
    year: ext.year,
    rating: ext.rating,
    runtime: ext.runtime,
    synopsis: ext.synopsis,
    genres: ext.genres,
    vibes: ext.vibes,
    providers: ext.providers,
    providerUrl: ext.providerUrl ?? null,
    watchLinks: ext.watchLinks ?? [],
    url: ext.url,
    imageUrl: ext.imageUrl,
    previewUrl: ext.previewUrl,
    trailerUrl: ext.trailerUrl,
    director: ext.director ?? null,
    cast: ext.cast ?? [],
  };
  await prisma.suggestion.upsert({ where: { id: ext.id }, create: { id: ext.id, ...data }, update: data });
  await prisma.historyEntry.create({ data: { suggestionId: ext.id, action: "suggested", userId } });
  // Default the optional array fields so the live result matches the non-null
  // GraphQL contract (only TMDB sets watchLinks; Spotify/Open Library don't).
  return { ...ext, watchLinks: ext.watchLinks ?? [], cast: ext.cast ?? [] };
}

// How many recent picks to avoid repeating before allowing them again. This is the
// DB-backed half of the no-repeat guarantee (the provider also tracks served ids per pool
// in memory). It must comfortably exceed a typical candidate pool (movies ~60–100) so that
// EVERY distinct title is shown before any repeat — even when the in-memory served set is
// cold (fresh process / serverless). Too small and a large pool repeats after ~window picks.
const RECENT_WINDOW = 80;
// Each re-roll is a fresh round of API calls, so keep it low to stay fast.
const PROVIDER_RETRIES = 2;
// Hard ceiling on live-provider work per spin; past this we serve the seed instantly.
const PROVIDER_BUDGET_MS = 4000;
// Music gets a larger budget: the FIRST spin for a filter pages Spotify deep (up to ~50 batched
// pages) to build the large unique-track pool, which takes longer than a single fetch. Subsequent
// spins reuse the cached pool and are instant, so only that first build needs the headroom.
const MUSIC_PROVIDER_BUDGET_MS = 8000;
// Open Library's filtered queries are slow on a cold cache — national-genre subjects
// (e.g. "Science fiction, Indic") can take ~7–9s — so books get a larger budget; once
// cached the next spins are instant.
const BOOK_PROVIDER_BUDGET_MS = 11000;

/** The ids most recently shown for this mode + user, so "Spin again" can skip them. */
async function recentlyPickedIds(prisma: PrismaClient, mode: Mode, userId: string | null): Promise<Set<string>> {
  const rows = await prisma.historyEntry.findMany({
    where: { action: "suggested", userId, suggestion: { mode } },
    orderBy: { createdAt: "desc" },
    take: RECENT_WINDOW,
    select: { suggestionId: true },
  });
  return new Set(rows.map((r) => r.suggestionId));
}

/**
 * Pick a random suggestion. Prefers the live provider (Spotify for music, TMDB for
 * movies/series); if no API key is set — or a call fails — it falls back to the
 * seeded catalogue in MySQL so the app always works. Recently shown picks are
 * avoided until the available pool is exhausted.
 */
export async function getRandomSuggestion(
  prisma: PrismaClient,
  mode: Mode,
  filter?: SuggestionFilter | null,
  userId: string | null = null,
  region?: string | null,
) {
  const recent = await recentlyPickedIds(prisma, mode, userId);

  // Resolve the multi-decade filter to a single decade per fetch (random within the set),
  // so each provider — which takes one year range — gets a concrete decade and successive
  // re-rolls cover all the selected decades.
  const fetchExternal = () => {
    const f = withProviderDecade(filter);
    return mode === "MUSIC"
      ? getRandomTrack(f, recent)
      : mode === "BOOK"
        ? getRandomBook(f, recent)
        : getRandomTitle(f, region ?? undefined, recent);
  };

  try {
    // Whole live attempt (initial pick + re-rolls) is time-boxed so a slow API
    // never stalls the spin — we drop to the instant seed pick instead.
    const ext = await withTimeout(
      (async () => {
        let e = await fetchExternal();
        for (let i = 0; i < PROVIDER_RETRIES && recent.has(e.id); i++) e = await fetchExternal();
        return e;
      })(),
      mode === "BOOK" ? BOOK_PROVIDER_BUDGET_MS : mode === "MUSIC" ? MUSIC_PROVIDER_BUDGET_MS : PROVIDER_BUDGET_MS,
    );
    return await persist(prisma, ext, userId);
  } catch (err) {
    if (!(err instanceof ProviderUnavailable)) console.error("[provider] falling back to seed:", err);
    return getRandomFromSeed(prisma, mode, filter, recent, userId);
  }
}

async function getRandomFromSeed(
  prisma: PrismaClient,
  mode: Mode,
  filter: SuggestionFilter | null | undefined,
  recent: Set<string>,
  userId: string | null,
) {
  // A region filter relies on live-provider metadata (TMDB origin country / Spotify
  // market) that the seed catalogue doesn't carry, so it can't be honoured offline.
  // Return an honest empty state rather than an off-region pick.
  if (filter?.country) return null;

  const candidates = await prisma.suggestion.findMany({
    where: {
      mode,
      source: "seed",
      ...(filter?.type && filter.type !== "either" ? { type: filter.type } : {}),
    },
  });

  // Any of the selected decades may match (multi-select); the legacy single `decade` is
  // folded in by selectedDecades(). Empty → no decade constraint.
  const decades = selectedDecades(filter);
  const inDecade = (s: Suggestion) =>
    !decades.length || (s.year != null && decades.some((d) => s.year! >= d && s.year! <= d + 9));
  const meetsRating = (s: Suggestion) => !filter?.minRating || (s.rating != null && s.rating >= filter.minRating);

  // Decade/rating are HARD constraints — never relaxed, or the fallback would
  // serve picks that plainly contradict the filter. Genre/vibe/text are soft and
  // widen if needed so an on-decade spin still returns something. (Country isn't
  // in the seed model, so it's only honoured by the live providers.)
  const hard = candidates.filter((s) => inDecade(s) && meetsRating(s));
  let pool = hard.filter(
    (s) => overlaps(s.genres, filter?.genres) && overlaps(s.vibes, filter?.vibes) && matchesText(s, filter?.query),
  );
  if (pool.length === 0) pool = hard;
  if (pool.length === 0) return null; // nothing in the seed matches the decade/rating

  // Drop recently shown picks, unless that would leave nothing (pool exhausted).
  const fresh = pool.filter((s) => !recent.has(s.id));
  const finalPool = fresh.length > 0 ? fresh : pool;

  const choice = finalPool[Math.floor(Math.random() * finalPool.length)];
  await prisma.historyEntry.create({ data: { suggestionId: choice.id, action: "suggested", userId } });
  return toSuggestionDTO(choice);
}
