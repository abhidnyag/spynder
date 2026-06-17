// Single source of truth for the genre/vibe options shown in the UI and used
// when seeding. Keeping it here avoids an extra round-trip just to list chips.

export type Mode = "MUSIC" | "MOVIE" | "BOOK";

export const TAXONOMY = {
  MUSIC: {
    genres: ["Pop", "Indie", "Hip-Hop", "Rock", "Lo-fi", "Jazz", "Electronic", "Classical"],
    vibes: ["Chill", "Energetic", "Sad", "Focus", "Party", "Romantic"],
  },
  MOVIE: {
    types: ["movie", "series"] as const,
    genres: ["Action", "Comedy", "Thriller", "Drama", "Sci-Fi", "Horror", "Romance", "Anime"],
    vibes: ["Feel-good", "Edge-of-seat", "Cozy", "Mind-bending", "Tear-jerker"],
  },
  BOOK: {
    genres: ["Fiction", "Mystery", "Sci-Fi", "Fantasy", "Romance", "Thriller", "Non-fiction", "Biography"],
    vibes: ["Cozy", "Page-turner", "Thought-provoking", "Heartwarming", "Dark"],
  },
} as const;

/** Decade filter (start year → that decade), newest first. Applies to every mode. */
export const DECADES: { label: string; value: number }[] = [
  { label: "2020s", value: 2020 },
  { label: "2010s", value: 2010 },
  { label: "2000s", value: 2000 },
  { label: "90s", value: 1990 },
  { label: "80s", value: 1980 },
  { label: "70s", value: 1970 },
  { label: "60s", value: 1960 },
  { label: "50s", value: 1950 },
  { label: "40s", value: 1940 },
];

/**
 * Region/country filter. `code` is an ISO 3166-1 country code used as TMDB's
 * origin-country (movies/series) and Spotify's market (music); `lang` is the
 * MARC language code used to bias Open Library results (books). Applies to all
 * modes, best-effort per the catalogue's capabilities.
 */
export const REGIONS: { label: string; code: string; lang: string }[] = [
  { label: "USA", code: "US", lang: "eng" },
  { label: "UK", code: "GB", lang: "eng" },
  { label: "India", code: "IN", lang: "eng" },
  { label: "Korea", code: "KR", lang: "kor" },
  { label: "Japan", code: "JP", lang: "jpn" },
  { label: "France", code: "FR", lang: "fre" },
  { label: "Spain", code: "ES", lang: "spa" },
  { label: "Germany", code: "DE", lang: "ger" },
  { label: "Russia", code: "RU", lang: "rus" },
  { label: "Italy", code: "IT", lang: "ita" },
  { label: "China", code: "CN", lang: "chi" },
  { label: "Ireland", code: "IE", lang: "eng" },
  { label: "Sweden", code: "SE", lang: "swe" },
];

/** MARC language code for a region (books); defaults to English. */
export const regionLang = (code?: string | null): string => REGIONS.find((r) => r.code === code)?.lang ?? "eng";

/**
 * Minimum-rating filter, per mode and on each mode's native scale: movies/series
 * use TMDB's 0–10 vote average, books use Open Library's 0–5 average. Music has
 * no rating, so it offers none.
 */
export const RATINGS: Record<Mode, { label: string; value: number }[]> = {
  MUSIC: [],
  MOVIE: [
    { label: "6+", value: 6 },
    { label: "7+", value: 7 },
    { label: "8+", value: 8 },
  ],
  BOOK: [
    { label: "3+", value: 3 },
    { label: "4+", value: 4 },
    { label: "4.5+", value: 4.5 },
  ],
};

export const MODE_META: Record<Mode, { label: string; greeting: string }> = {
  MUSIC: { label: "Music", greeting: "What to listen to?" },
  MOVIE: { label: "Movies & TV", greeting: "What to watch?" },
  BOOK: { label: "Books", greeting: "What to read?" },
};
