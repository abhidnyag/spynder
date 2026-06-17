import { type ExternalSuggestion, type SuggestionFilter, fetchJson, pick, timeoutSignal } from "./types";
import { cachedPool, filterKey, isCacheableFilter, pickUnseen } from "./cache";

// Open Library is fully free and keyless (no quota), so books work live out of the
// box — unlike Spotify/TMDB. Its search `q` matches titles, authors AND subjects, so
// a free-text vibe genuinely steers results; we add a `subject:` for genre chips.
const API = "https://openlibrary.org/search.json";
const COVERS = "https://covers.openlibrary.org/b/id";
const PAGE = 40; // one page of candidates — enough variety without a second slow round-trip
// `editions` (scoped to the query's `language=eng`) carries the ENGLISH edition title, so a
// Russian/Japanese/etc. work shows as "The Double" rather than its Cyrillic work title "Двойник".
// NB: the bare `editions` field MUST be requested — `editions.title` alone returns nothing.
const FIELDS = "key,title,author_name,first_publish_year,cover_i,subject,ratings_average,number_of_pages_median,first_sentence,edition_count,readinglog_count,editions,editions.title";

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

// Region → an Open Library "nationality fiction" subject, the books analogue of the
// movie origin-country / music local-genre mapping. Open Library's `language:` filter
// returns global bestsellers TRANSLATED into that language (Wimpy Kid in Korean), not
// books FROM the country — whereas this subject reliably surfaces native authors
// (IN→Chetan Bhagat, KR→Han Kang, JP→Murakami, FR→Pennac). Applied as a `subject:`
// constraint; the edition language stays English for readability.
// One or more nationality subjects per region, OR'd together in the query. India uses the
// precise "Indic fiction" — the broader "Indian fiction" subject also matches *Native
// American* titles (Library of Congress overloads "Indian"), so it's deliberately omitted.
// (The map is still string[] so a region can list multiple subjects when accurate.)
const COUNTRY_SUBJECTS: Record<string, string[]> = {
  US: ["American fiction"],
  GB: ["English fiction"],
  IN: ["Indic fiction"],
  KR: ["Korean fiction"],
  JP: ["Japanese fiction"],
  FR: ["French fiction"],
  ES: ["Spanish fiction"],
  DE: ["German fiction"],
  RU: ["Russian fiction"], // Dostoevsky, Tolstoy, the Strugatskys
  IT: ["Italian literature"], // Calvino, Eco — "Italian fiction" is mostly Harlequin romance
  CN: ["Chinese fiction"], // Liu Cixin, Mo Yan
  IE: ["Irish literature"], // Joyce, Wilde, Beckett — "Irish fiction" leaks English authors
  SE: ["Swedish fiction"], // Nordic noir, Lindgren
};

// "<Country> mythology" subjects. A country + a mythology request needs these because myth
// books are tagged e.g. "Japanese mythology" — NEVER "Japanese fiction" — so the fiction
// clause above would return zero. Countries whose specific subject is too sparse
// (France/Spain/US) are omitted and fall back to the generic "Mythology" subject.
const COUNTRY_MYTHOLOGY: Record<string, string> = {
  IN: "Hindu mythology",
  KR: "Korean mythology",
  JP: "Japanese mythology",
  DE: "German mythology",
  GB: "British mythology",
  RU: "Slavic mythology", // Russia's own "Russian mythology" subject is near-empty
  IE: "Celtic mythology",
  SE: "Norse mythology",
};

// Our genre/content subject → its Library-of-Congress genre heading. Open Library catalogues
// NATIONAL genre fiction as a combined "<Genre>, <Nationality>" subject (e.g. "Science fiction,
// Indic" → real Indian SF by Sukanya Datta/Samit Basu; "Science fiction, American" → Bradbury/
// Gibson). That surfaces genuine national-genre authors far better than ANDing "<Nationality>
// fiction" with the genre. Genres without a heading fall back to that AND.
const GENRE_LC: Record<string, string> = {
  "Science Fiction": "Science fiction",
  Mystery: "Detective and mystery stories",
  Fantasy: "Fantasy fiction",
  Romance: "Love stories",
  Horror: "Horror tales",
  "Historical fiction": "Historical fiction",
};

// Description/vibe words → Open Library subjects, so a typed mood searches by CONTENT (the
// book's theme/genre) rather than literal title text: "futuristic" finds sci-fi, "mythological"
// finds myth retellings — not just books with that word in the title. The books analogue of
// the movie `VIBE_GENRE_HINTS` / music `VIBE_GENRE_TAGS`. Unmapped words stay as free-text
// relevance terms, and a mapped subject combines with the country/genre subjects.
const VIBE_SUBJECTS: Record<string, string> = {
  // Sci-fi / speculative
  futuristic: "Science Fiction", dystopian: "Science Fiction", dystopia: "Science Fiction",
  cyberpunk: "Science Fiction", apocalyptic: "Science Fiction", "post-apocalyptic": "Science Fiction",
  space: "Science Fiction", scifi: "Science Fiction", "sci-fi": "Science Fiction", aliens: "Science Fiction",
  // Fantasy / fairy-tale
  magical: "Fantasy", magic: "Fantasy", fantasy: "Fantasy", wizards: "Fantasy", dragons: "Fantasy",
  enchanted: "Fantasy", fairytale: "Fantasy",
  // Myth / legend. Generic synonyms → "Mythology"; a named tradition → its OWN subject (so
  // "celtic" returns Celtic myth, not all mythology); fables/folktales → Folklore/Fables.
  mythological: "Mythology", mythical: "Mythology", mythology: "Mythology", mythos: "Mythology",
  myth: "Mythology", myths: "Mythology", legend: "Mythology", legends: "Mythology",
  legendary: "Mythology", pantheon: "Mythology", demigod: "Mythology", demigods: "Mythology",
  deity: "Mythology", deities: "Mythology", goddess: "Mythology",
  celtic: "Celtic mythology", norse: "Norse mythology", greek: "Greek mythology",
  roman: "Roman mythology", egyptian: "Egyptian mythology", hindu: "Hindu mythology",
  folklore: "Folklore", folktale: "Folklore", folktales: "Folklore", lore: "Folklore",
  fable: "Fables", fables: "Fables",
  // Mystery / crime
  mystery: "Mystery", detective: "Mystery", whodunit: "Mystery", noir: "Mystery", murder: "Mystery", crime: "Mystery",
  // Horror
  horror: "Horror", scary: "Horror", spooky: "Horror", creepy: "Horror", ghost: "Horror",
  haunted: "Horror", gothic: "Horror", supernatural: "Horror",
  // Romance
  romance: "Romance", romantic: "Romance",
  // Thriller / suspense
  thriller: "Thriller", suspense: "Thriller", spy: "Thriller", espionage: "Thriller",
  // Historical (fiction). Deliberately NOT mapping ambiguous words like "history", "war" or
  // "military" — those are huge NON-fiction categories, so they stay as free-text terms that
  // match both fiction and non-fiction rather than being forced into a fiction subject.
  historical: "Historical fiction",
  // Adventure / humour
  adventure: "Adventure", survival: "Adventure", funny: "Humor", hilarious: "Humor", humorous: "Humor",
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
  edition_count?: number;
  readinglog_count?: number;
  editions?: { docs?: { title?: string }[] };
}

// Scripts whose titles aren't readable to most English users — prefer the English edition title
// when the work title is in one of these (Cyrillic, CJK, Hiragana/Katakana, Hangul, Arabic, Hebrew).
const NON_LATIN = /[Ѐ-ӿ一-鿿぀-ヿ가-힯؀-ۿ֐-׿]/;

/** The work's title, but swapped for an English (Latin-script) edition title when it's non-Latin. */
function displayTitle(d: OLDoc): string {
  const work = d.title ?? "";
  if (!NON_LATIN.test(work)) return work;
  const english = d.editions?.docs?.find((e) => e.title && !NON_LATIN.test(e.title))?.title;
  return english ?? work;
}
interface OLResponse {
  numFound?: number;
  docs?: OLDoc[];
}

function url(q: string, offset: number, lang = "eng", sort?: string): string {
  const params = new URLSearchParams({ q, fields: FIELDS, language: lang, limit: String(PAGE), offset: String(offset) });
  if (sort) params.set("sort", sort);
  return `${API}?${params}`;
}

/**
 * Build the search query. A genre chip adds a `subject:` constraint; the free-text
 * vibe is searched on its own (Open Library ranks by relevance across title/subject/
 * text). Only when there's nothing to go on do we seed a random subject.
 */
function buildQuery(filter?: SuggestionFilter | null): string {
  const code = filter?.country?.toUpperCase();
  const genre = filter?.genres?.length ? pick(filter.genres) : null;
  const genreSubject = genre ? (SUBJECTS[genre] ?? genre) : null;
  // The nationality subjects are fiction-specific ("Indic fiction"), so they'd contradict a
  // non-fiction genre and return nothing — drop the country clause for Non-fiction/Biography
  // (country can't be honoured for non-fiction in Open Library's catalogue anyway).
  const nonFiction = genreSubject === "Nonfiction" || genreSubject === "Biography";

  // Genre chip + recognised description/vibe words → content `subject:` constraints (a
  // CONTENT search, not a literal title match); unknown words stay as free-text terms.
  const contentSubjects = new Set<string>();
  if (genreSubject) contentSubjects.add(genreSubject);
  const free: string[] = [];
  for (const word of [...(filter?.vibes ?? []), filter?.query].filter(Boolean).join(" ").trim().split(/[\s,]+/)) {
    if (!word) continue;
    const subject = VIBE_SUBJECTS[word.toLowerCase()];
    if (subject) contentSubjects.add(subject);
    else free.push(word);
  }

  // Mythology/folklore content is tagged "<Country> mythology", never "<Country> fiction", so
  // the fiction clause would zero it out. For a country + a GENERIC mythology request, switch
  // to that country's own mythology subject (Japan → "Japanese mythology") when it has a
  // well-populated one. Either way, a myth/folklore request drops the conflicting fiction clause.
  const mythLike = [...contentSubjects].some((s) => s === "Mythology" || s.endsWith("mythology") || s === "Folklore");
  if (code && contentSubjects.has("Mythology") && COUNTRY_MYTHOLOGY[code]) {
    contentSubjects.delete("Mythology");
    contentSubjects.add(COUNTRY_MYTHOLOGY[code]);
  }

  // Assemble the subject clauses. Country fiction applies only for a fiction-genre request
  // (non-fiction and mythology aren't tagged as a country's "fiction").
  const fictionCountry = !!code && !nonFiction && !mythLike;
  const fictionSubject = fictionCountry ? (COUNTRY_SUBJECTS[code!] ?? [])[0] ?? "" : "";
  const nationality = fictionSubject.replace(/ (?:fiction|literature)$/, ""); // "Indic fiction" → "Indic"

  const subjectClauses: string[] = [];
  if (fictionCountry && contentSubjects.size > 0) {
    // National GENRE fiction: prefer the combined "<Genre>, <Nationality>" heading (accurate),
    // falling back to "<Nationality> fiction" AND the genre for genres without a heading.
    for (const cs of contentSubjects) {
      subjectClauses.push(
        GENRE_LC[cs] ? `subject:"${GENRE_LC[cs]}, ${nationality}"` : `subject:"${fictionSubject}" subject:"${cs}"`,
      );
    }
  } else if (fictionCountry) {
    // Country only (no genre/vibe) → that country's nationality fiction.
    if (fictionSubject) subjectClauses.push(`subject:"${fictionSubject}"`);
  } else {
    // Non-fiction / mythology / no country: the content subjects as-is (a country mythology
    // subject was already merged into contentSubjects above).
    for (const cs of contentSubjects) subjectClauses.push(`subject:"${cs}"`);
  }

  const year = filter?.decade ? `first_publish_year:[${filter.decade} TO ${filter.decade + 9}]` : "";
  const parts = [...subjectClauses, free.join(" "), year].filter(Boolean);
  if (parts.length) return parts.join(" ");
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

// A book is "established" if real readers have logged it and it has been published in
// several editions with cover art — a strong signal it's a real, findable book rather
// than one of Open Library's many obscure self-published records.
const isEstablished = (d: OLDoc): boolean =>
  d.cover_i != null && ((d.edition_count ?? 0) >= 3 || (d.readinglog_count ?? 0) >= 50);

// Country is honoured via the nationality `subject:` in buildQuery (not the edition
// language, which only returns translated bestsellers), so editions stay English for
// readable titles — a Korean pick is Han Kang in English, not in Hangul.
const LANG = "eng";

/**
 * Pool several pages of a query (in parallel, de-duplicated) so "Spin again" keeps finding
 * fresh books — the pool is cached for 5 min, and one page (~40) gets recycled otherwise.
 * Each page fails soft so a slow/failed deep page never sinks the spin. The timeout is
 * generous: Open Library's national-genre subject queries (e.g. "Science fiction, Indic")
 * are slow on a cold cache (~7–9s) but fast once warm — and a thrown spin isn't cached, so
 * the next "Spin again" retries the now-warm query and succeeds.
 */
async function fetchPages(q: string, sort?: string): Promise<OLDoc[]> {
  const offsets = [0, PAGE, PAGE * 2];
  const pages = await Promise.all(
    offsets.map((off) =>
      fetchJson<OLResponse>(url(q, off, LANG, sort), { signal: timeoutSignal(9000) }, 0)
        .then((r) => r.docs ?? [])
        .catch(() => [] as OLDoc[]),
    ),
  );
  const byKey = new Map<string, OLDoc>();
  for (const d of pages.flat()) if (d.title && d.key && !byKey.has(d.key)) byKey.set(d.key, d);
  return [...byKey.values()];
}

/** Fetch a pool of candidate books for the filter (cached per query). */
async function fetchDocs(filter?: SuggestionFilter | null): Promise<OLDoc[]> {
  // A year-range query under the default (relevance) sort scans millions of records
  // and routinely exceeds the timeout (or errors). Sorting by readers ("readinglog")
  // hits an index — fast AND returns recognisable in-decade books. Plain (no-decade)
  // searches keep relevance ranking. The service grants books a larger budget, and a
  // success caches the pool so re-spins are instant.
  const sort = filter?.decade ? "readinglog" : undefined;
  let all = await fetchPages(buildQuery(filter), sort);

  // A country + genre/vibe can over-narrow (Open Library barely cross-tags nationality with
  // genre — Indian romance ≈ 1 book) or the slow national-genre query can time out. Rather than
  // dead-end or drift to GLOBAL titles, keep the country (the user's strong signal) and relax
  // the genre/vibe: fall back to that country's general fiction, so the pick is still a PROPER
  // national book (Indian sci-fi when it exists, otherwise an Indian novel — never a global one).
  const hasContent = Boolean(filter?.genres?.length || filter?.vibes?.length || (filter?.query ?? "").trim());
  // The country fallback is fiction ("Indic fiction"), so skip it for a non-fiction genre
  // (country isn't applied there anyway).
  const nonFictionGenre = (filter?.genres ?? []).some((g) => {
    const s = SUBJECTS[g] ?? g;
    return s === "Nonfiction" || s === "Biography";
  });
  if (filter?.country && hasContent && !nonFictionGenre && all.length < 5) {
    const national = await fetchPages(buildQuery({ country: filter.country, decade: filter.decade }), sort);
    const byKey = new Map<string, OLDoc>();
    for (const d of [...all, ...national]) if (d.title && d.key && !byKey.has(d.key)) byKey.set(d.key, d);
    all = [...byKey.values()];
  }

  // Keep relevance order, but drop obscure junk so a vibe returns real, recognisable
  // books. Fall back gradually so a niche query still returns something.
  const established = all.filter(isEstablished);
  const withCover = all.filter((d) => d.cover_i != null);
  let docs = established.length >= 5 ? established : withCover.length >= 5 ? withCover : all;

  // Open Library can't filter by rating in the query, so apply it here. Keep the
  // filtered set whenever it has anything; otherwise fall back (don't dead-end).
  if (filter?.minRating) {
    const rated = docs.filter((d) => (d.ratings_average ?? 0) >= filter.minRating!);
    if (rated.length) docs = rated;
  }
  if (docs.length === 0) throw new Error("Open Library returned no results");
  return docs;
}

/** First 2–3 sentences of a string, trimmed — a short blurb, not a wall of text. */
function firstSentences(text: string, max = 3): string {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+(?:["')\]]+)?/g);
  if (!sentences) return text.trim();
  return sentences.slice(0, max).join(" ").trim();
}

/**
 * A short 2–3 sentence summary for a book. Open Library's search only returns the first
 * sentence, so we read the work record's `description` (a string, or `{ value }`), strip its
 * trailing "([source][1]) … [1]: http…" footnotes, and keep the opening few sentences. Fails
 * soft (returns null) so a missing/slow description never sinks the spin.
 */
async function bookSummary(workKey: string, fallback: string | null): Promise<string | null> {
  try {
    const data = await fetchJson<{ description?: string | { value?: string } }>(
      `https://openlibrary.org${workKey}.json`,
      { signal: timeoutSignal(3500) },
      0,
    );
    const raw = typeof data.description === "string" ? data.description : data.description?.value;
    const clean = raw
      ?.replace(/\r\n/g, "\n")
      .replace(/\n*\(\[source\]\[\d+\]\)[\s\S]*$/i, "")
      .replace(/\n*-{3,}[\s\S]*$/, "")
      .trim();
    return clean ? firstSentences(clean) : fallback;
  } catch {
    return fallback;
  }
}

/** A random book from Open Library, narrowed by the filter when present. */
export async function getRandomBook(
  filter?: SuggestionFilter | null,
  exclude?: Set<string> | null,
): Promise<ExternalSuggestion> {
  const key = isCacheableFilter(filter) ? filterKey("BOOK", filter) : null;
  const docs = await cachedPool(key, () => fetchDocs(filter));

  // Mapping is pure, so a cached pool makes repeat "Spin again" picks instant.
  const d = pickUnseen(key, docs, (x) => `openlib:${x.key.replace(/^\/works\//, "")}`, exclude);
  // A 2–3 sentence blurb from the work record, falling back to the search's first sentence.
  const synopsis = await bookSummary(d.key, firstSentence(d.first_sentence));
  return {
    id: `openlib:${d.key.replace(/^\/works\//, "")}`,
    mode: "BOOK",
    source: "open_library",
    type: null,
    title: displayTitle(d),
    artist: d.author_name?.slice(0, 2).join(", ") ?? null, // author lives in the shared `artist` field
    year: d.first_publish_year || null, // OL sometimes reports 0 → treat as unknown
    rating: d.ratings_average ? Math.round(d.ratings_average * 10) / 10 : null,
    runtime: d.number_of_pages_median ? `${d.number_of_pages_median} pages` : null,
    synopsis,
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
