import { TAXONOMY } from "@/lib/taxonomy";
import { type ExternalSuggestion, type SuggestionFilter, fetchJson, pick, rand } from "./types";

// Google Books needs no API key for modest use (an optional key lifts the quota).
// Unlike TMDB title search, the Books `q` matches titles AND descriptions, so a
// free-text vibe genuinely steers results — we just add a `subject:` for genre chips.
const API = "https://www.googleapis.com/books/v1/volumes";
const PAGE = 40; // Google Books max per request

// Our genre chips → Google Books subject names.
const SUBJECTS: Record<string, string> = {
  Fiction: "Fiction",
  Mystery: "Mystery",
  "Sci-Fi": "Science Fiction",
  Fantasy: "Fantasy",
  Romance: "Romance",
  Thriller: "Thrillers",
  "Non-fiction": "Nonfiction",
  Biography: "Biography & Autobiography",
};

interface GVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    publisher?: string;
    description?: string;
    pageCount?: number;
    averageRating?: number;
    categories?: string[];
    infoLink?: string;
    canonicalVolumeLink?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}
interface GResponse {
  totalItems?: number;
  items?: GVolume[];
}

function url(q: string, startIndex: number): string {
  const params = new URLSearchParams({
    q,
    orderBy: "relevance",
    printType: "books",
    langRestrict: "en",
    maxResults: String(PAGE),
    startIndex: String(startIndex),
  });
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) params.set("key", key);
  return `${API}?${params}`;
}

/** Build the Books query: a `subject:` for the genre chip + the free-text vibe. */
function buildQuery(filter?: SuggestionFilter | null): string {
  const genre = filter?.genres?.length ? pick(filter.genres) : null;
  const subject = genre ? (SUBJECTS[genre] ?? genre) : pick(Object.values(SUBJECTS));
  const free = [...(filter?.vibes ?? []), filter?.query].filter(Boolean).join(" ").trim();
  return [`subject:"${subject}"`, free].filter(Boolean).join(" ");
}

/** A random book from Google Books, narrowed by the filter when present. */
export async function getRandomBook(filter?: SuggestionFilter | null): Promise<ExternalSuggestion> {
  const q = buildQuery(filter);

  const first = await fetchJson<GResponse>(url(q, 0));
  let items = first.items ?? [];
  // Spread picks across the result set instead of always returning the top page.
  const total = Math.min(first.totalItems ?? 0, 200);
  if (total > PAGE) {
    const start = rand(Math.floor(total / PAGE)) * PAGE;
    if (start > 0) {
      const more = await fetchJson<GResponse>(url(q, start));
      if (more.items?.length) items = more.items;
    }
  }
  // Keep only volumes we can actually show (a title at minimum).
  items = items.filter((v) => v.volumeInfo?.title);
  if (items.length === 0) throw new Error("Google Books returned no results");

  const v = pick(items);
  const info = v.volumeInfo!;
  const cover = (info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail)?.replace("http://", "https://") ?? null;

  return {
    id: `gbooks:${v.id}`,
    mode: "BOOK",
    source: "google_books",
    type: null,
    title: info.title!,
    artist: info.authors?.join(", ") ?? null, // author lives in the shared `artist` field
    year: Number((info.publishedDate ?? "").slice(0, 4)) || null,
    rating: info.averageRating ?? null,
    runtime: info.pageCount ? `${info.pageCount} pages` : null,
    synopsis: info.description ?? null,
    genres: (info.categories ?? []).slice(0, 3),
    vibes: filter?.vibes ?? [],
    providers: info.publisher ? [info.publisher] : [],
    url: info.infoLink ?? info.canonicalVolumeLink ?? null,
    imageUrl: cover,
    previewUrl: null,
    trailerUrl: null,
  };
}

// Re-exported for tests / parity with the other providers.
export const BOOK_SUBJECTS = SUBJECTS;
export const BOOK_GENRES = TAXONOMY.BOOK.genres;
