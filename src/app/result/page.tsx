import { ResultScreen } from "@/components/screens/ResultScreen";
import type { Mode } from "@/lib/taxonomy";
import type { SuggestionFilter } from "@/types";

type SearchParams = Promise<Record<string, string | undefined>>;

// Server component: parse URL params, hand a typed mode + filter to the client.
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const mode: Mode = sp.mode === "MOVIE" ? "MOVIE" : sp.mode === "BOOK" ? "BOOK" : "MUSIC";

  // Comma-separated start years, e.g. "1990,2010" → [1990, 2010].
  const decades = sp.decades
    ? sp.decades.split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  const filter: SuggestionFilter = {
    ...(sp.type ? { type: sp.type } : {}),
    ...(sp.genres ? { genres: sp.genres.split(",") } : {}),
    ...(sp.subgenres ? { subgenres: sp.subgenres.split(",") } : {}),
    ...(sp.vibes ? { vibes: sp.vibes.split(",") } : {}),
    ...(sp.q ? { query: sp.q } : {}),
    ...(decades.length ? { decades } : {}),
    ...(sp.rating && Number(sp.rating) ? { minRating: Number(sp.rating) } : {}),
    ...(sp.country ? { country: sp.country } : {}),
  };

  return <ResultScreen mode={mode} filter={filter} />;
}
