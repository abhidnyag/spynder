import { type ExternalSuggestion, type SuggestionFilter, fetchJson, pick, rand } from "./types";

// Open Library is fully free and keyless (no quota), so books work live out of the
// box — unlike Spotify/TMDB. Its search `q` matches titles, authors AND subjects, so
// a free-text vibe genuinely steers results; we add a `subject:` for genre chips.
const API = "https://openlibrary.org/search.json";
const COVERS = "https://covers.openlibrary.org/b/id";
const PAGE = 20;
const FIELDS = "key,title,author_name,first_publish_year,cover_i,subject,ratings_average,number_of_pages_median,first_sentence";

// Our genre chips → Open Library subject names.
const SUBJECTS: Record<string, string> = {
  Fiction: "Fiction",
  Mystery: "Mystery",
  "Sci-Fi": "Science Fiction",
  Fantasy: "Fantasy",
  Romance: "Romance",
  Thriller: "Thriller",
  "Non-fiction": "Nonfiction",
  Biography: "Biography",
};

interface OLDoc {
  key: string; // e.g. "/works/OL12345W"
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
  ratings_average?: number;
  number_of_pages_median?: number;
  first_sentence?: string[] | string;
}
interface OLResponse {
  numFound?: number;
  docs?: OLDoc[];
}

function url(q: string, offset: number): string {
  const params = new URLSearchParams({ q, fields: FIELDS, language: "eng", limit: String(PAGE), offset: String(offset) });
  return `${API}?${params}`;
}

/**
 * Build the search query. A genre chip adds a `subject:` constraint; the free-text
 * vibe is searched on its own (Open Library ranks by relevance across title/subject/
 * text). Only when there's nothing to go on do we seed a random subject.
 */
function buildQuery(filter?: SuggestionFilter | null): string {
  const genre = filter?.genres?.length ? pick(filter.genres) : null;
  const subject = genre ? `subject:"${SUBJECTS[genre] ?? genre}"` : "";
  const free = [...(filter?.vibes ?? []), filter?.query].filter(Boolean).join(" ").trim();
  if (subject || free) return [subject, free].filter(Boolean).join(" ");
  return `subject:"${pick(Object.values(SUBJECTS))}"`;
}

const firstSentence = (s: OLDoc["first_sentence"]): string | null =>
  Array.isArray(s) ? (s[0] ?? null) : (s ?? null);

// Open Library subjects are noisy — they mix real genres with award tags
// ("award:hugo_award=1956"), character names, places, reading levels, etc. Map the
// recognisable ones to clean human genres (specific before the generic "Fiction").
const GENRE_RULES: [RegExp, string][] = [
  [/science fiction|sci-?fi/i, "Sci-Fi"],
  [/fantasy/i, "Fantasy"],
  [/mystery|detective|crime/i, "Mystery"],
  [/thriller|suspense|espionage|spy/i, "Thriller"],
  [/horror/i, "Horror"],
  [/romance|love stor/i, "Romance"],
  [/adventure/i, "Adventure"],
  [/biography|autobiograph|memoir/i, "Biography"],
  [/histor/i, "Historical"],
  [/poetry|poems/i, "Poetry"],
  [/young adult|juvenile|children/i, "Young Adult"],
  [/non-?fiction/i, "Non-fiction"],
  [/fiction/i, "Fiction"],
];

function cleanGenres(subjects?: string[]): string[] {
  const out: string[] = [];
  for (const s of subjects ?? []) {
    const match = GENRE_RULES.find(([re]) => re.test(s))?.[1];
    if (match && !out.includes(match)) out.push(match);
    if (out.length >= 3) break;
  }
  // Drop the generic "Fiction" once a more specific genre is present.
  return out.length > 1 ? out.filter((g) => g !== "Fiction") : out;
}

/** A random book from Open Library, narrowed by the filter when present. */
export async function getRandomBook(filter?: SuggestionFilter | null): Promise<ExternalSuggestion> {
  const q = buildQuery(filter);

  const first = await fetchJson<OLResponse>(url(q, 0));
  let docs = first.docs ?? [];
  // Spread picks across the result set instead of always returning the top page.
  const total = Math.min(first.numFound ?? 0, 200);
  if (total > PAGE) {
    const offset = rand(Math.floor(total / PAGE)) * PAGE;
    if (offset > 0) {
      const more = await fetchJson<OLResponse>(url(q, offset));
      if (more.docs?.length) docs = more.docs;
    }
  }
  docs = docs.filter((d) => d.title && d.key);
  if (docs.length === 0) throw new Error("Open Library returned no results");

  const d = pick(docs);
  return {
    id: `openlib:${d.key.replace(/^\/works\//, "")}`,
    mode: "BOOK",
    source: "open_library",
    type: null,
    title: d.title!,
    artist: d.author_name?.slice(0, 2).join(", ") ?? null, // author lives in the shared `artist` field
    year: d.first_publish_year || null, // OL sometimes reports 0 → treat as unknown
    rating: d.ratings_average ? Math.round(d.ratings_average * 10) / 10 : null,
    runtime: d.number_of_pages_median ? `${d.number_of_pages_median} pages` : null,
    synopsis: firstSentence(d.first_sentence),
    genres: cleanGenres(d.subject),
    vibes: filter?.vibes ?? [],
    providers: [],
    url: `https://openlibrary.org${d.key}`,
    imageUrl: d.cover_i ? `${COVERS}/${d.cover_i}-L.jpg` : null,
    previewUrl: null,
    trailerUrl: null,
  };
}

// Re-exported for parity with the other providers.
export const BOOK_SUBJECTS = SUBJECTS;
