import type { Mode, PrismaClient, Suggestion } from "@prisma/client";
import { getRandomTrack } from "@/server/providers/spotify";
import { getRandomTitle } from "@/server/providers/tmdb";
import { ProviderUnavailable, type ExternalSuggestion } from "@/server/providers/types";

export interface SuggestionFilter {
  type?: string | null;
  genres?: string[] | null;
  vibes?: string[] | null;
  query?: string | null;
}

/** Normalise a Prisma row's JSON columns into plain string arrays for GraphQL. */
export function toSuggestionDTO(s: Suggestion) {
  return {
    ...s,
    genres: (s.genres as string[]) ?? [],
    vibes: (s.vibes as string[]) ?? [],
    providers: (s.providers as string[]) ?? [],
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
    url: ext.url,
    imageUrl: ext.imageUrl,
    previewUrl: ext.previewUrl,
    trailerUrl: ext.trailerUrl,
  };
  await prisma.suggestion.upsert({ where: { id: ext.id }, create: { id: ext.id, ...data }, update: data });
  await prisma.historyEntry.create({ data: { suggestionId: ext.id, action: "suggested", userId } });
  return ext;
}

// How many recent picks to avoid repeating before allowing them again.
const RECENT_WINDOW = 8;
const PROVIDER_RETRIES = 5;

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
) {
  const recent = await recentlyPickedIds(prisma, mode, userId);

  try {
    let ext = mode === "MUSIC" ? await getRandomTrack(filter) : await getRandomTitle(filter);
    // Re-roll a few times if the provider hands back something just shown.
    for (let i = 0; i < PROVIDER_RETRIES && recent.has(ext.id); i++) {
      ext = mode === "MUSIC" ? await getRandomTrack(filter) : await getRandomTitle(filter);
    }
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
  const candidates = await prisma.suggestion.findMany({
    where: {
      mode,
      source: "seed",
      ...(filter?.type && filter.type !== "either" ? { type: filter.type } : {}),
    },
  });

  let pool = candidates.filter(
    (s) => overlaps(s.genres, filter?.genres) && overlaps(s.vibes, filter?.vibes) && matchesText(s, filter?.query),
  );
  if (pool.length === 0) pool = candidates;
  if (pool.length === 0) return null;

  // Drop recently shown picks, unless that would leave nothing (pool exhausted).
  const fresh = pool.filter((s) => !recent.has(s.id));
  const finalPool = fresh.length > 0 ? fresh : pool;

  const choice = finalPool[Math.floor(Math.random() * finalPool.length)];
  await prisma.historyEntry.create({ data: { suggestionId: choice.id, action: "suggested", userId } });
  return toSuggestionDTO(choice);
}
