import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRandomBook } from "../books";
import { clearCandidateCache } from "../cache";
import { jsonOk, mockFetch } from "./fetchMock";

const DOC = {
  key: "/works/OL1234W",
  title: "Dune",
  author_name: ["Frank Herbert"],
  first_publish_year: 1965,
  cover_i: 555,
  subject: ["Science fiction", "Adventure"],
  ratings_average: 4.23,
  number_of_pages_median: 412,
  first_sentence: ["A beginning is the time for taking the most delicate care."],
};
const qOf = (url: string) => new URL(url).searchParams.get("q") ?? "";

afterEach(() => {
  vi.restoreAllMocks();
  clearCandidateCache();
});

describe("getRandomBook", () => {
  it("maps a genre chip to a subject, searches the vibe text, and builds a Suggestion", async () => {
    let query = "";
    mockFetch((url) => {
      if (url.includes("openlibrary.org/search.json")) {
        query = qOf(url);
        return jsonOk({ numFound: 1, docs: [DOC] });
      }
      return undefined;
    });

    const s = await getRandomBook({ genres: ["Sci-Fi"], query: "mind-bending" });

    // genre → subject, and the vibe is part of the query (Open Library searches subjects/text).
    expect(query).toBe('subject:"Science Fiction" mind-bending');
    expect(s.id).toBe("openlib:OL1234W");
    expect(s.mode).toBe("BOOK");
    expect(s.source).toBe("open_library");
    expect(s.title).toBe("Dune");
    expect(s.artist).toBe("Frank Herbert"); // author in the shared `artist` field
    expect(s.year).toBe(1965);
    expect(s.rating).toBe(4.2);
    expect(s.runtime).toBe("412 pages");
    expect(s.imageUrl).toBe("https://covers.openlibrary.org/b/id/555-L.jpg");
    expect(s.genres).toEqual(["Sci-Fi", "Adventure"]);
  });

  it("cleans noisy Open Library subjects into real genres (drops award tags etc.)", async () => {
    // The "Double Star" case: subjects mixed real genres with junk.
    mockFetch((url) =>
      url.includes("openlibrary.org/search.json")
        ? jsonOk({ numFound: 1, docs: [{ ...DOC, subject: ["award:hugo_award=1956", "Science fiction", "Politicians", "Fiction", "Impersonation"] }] })
        : undefined,
    );

    const s = await getRandomBook({ genres: ["Sci-Fi"] });

    // Sci-Fi recognised; award tag + character/place noise + generic "Fiction" dropped.
    expect(s.genres).toEqual(["Sci-Fi"]);
  });

  it("maps a content word in the description to a subject (cozy mystery → Mystery subject)", async () => {
    let query = "";
    mockFetch((url) => {
      if (url.includes("openlibrary.org/search.json")) {
        query = qOf(url);
        return jsonOk({ numFound: 1, docs: [DOC] });
      }
      return undefined;
    });

    await getRandomBook({ query: "cozy mystery" });

    // "mystery" → a CONTENT subject (finds mysteries, not books with "mystery" in the title);
    // "cozy" has no subject mapping, so it stays as a free-text relevance term.
    expect(query).toBe('subject:"Mystery" cozy');
  });

  it("maps a vibe description to a content subject, combined with the country subject", async () => {
    let query = "";
    mockFetch((url) => {
      if (url.includes("openlibrary.org/search.json")) {
        query ||= qOf(url); // capture the PRIMARY query (a sparse pool may also fire a relaxed one)
        return jsonOk({ numFound: 1, docs: [DOC] });
      }
      return undefined;
    });

    await getRandomBook({ country: "IN", query: "futuristic" });

    // "futuristic" → Science Fiction, expressed as the national genre heading "Science
    // fiction, Indic" (real Indian SF), not a literal title match or a global pick.
    expect(query).toBe('subject:"Science fiction, Indic"');
  });

  it("builds the national-genre heading for a country + genre (India + Sci-Fi)", async () => {
    let query = "";
    mockFetch((url) => {
      if (url.includes("openlibrary.org/search.json")) {
        query ||= qOf(url);
        return jsonOk({ numFound: 9, docs: [DOC] });
      }
      return undefined;
    });

    await getRandomBook({ country: "IN", genres: ["Sci-Fi"] });

    // Real Indian SF via the combined heading, not "Indic fiction" AND "Science Fiction".
    expect(query).toBe('subject:"Science fiction, Indic"');
  });

  it("maps mythology-related words to their subject (celtic → Celtic mythology)", async () => {
    let query = "";
    mockFetch((url) => {
      if (url.includes("openlibrary.org/search.json")) {
        query = qOf(url);
        return jsonOk({ numFound: 1, docs: [DOC] });
      }
      return undefined;
    });

    await getRandomBook({ query: "celtic" });

    // A named tradition maps to its specific subject, not generic "Mythology".
    expect(query).toBe('subject:"Celtic mythology"');
  });

  it("uses the country's own mythology subject (Japan + mythology → Japanese mythology)", async () => {
    let query = "";
    mockFetch((url) => {
      if (url.includes("openlibrary.org/search.json")) {
        query ||= qOf(url);
        return jsonOk({ numFound: 1, docs: [DOC] });
      }
      return undefined;
    });

    await getRandomBook({ country: "JP", query: "mythology" });

    // Myth books are tagged "Japanese mythology", not "Japanese fiction" — use that subject
    // and drop the conflicting fiction clause.
    expect(query).toBe('subject:"Japanese mythology"'); // primary query (relaxation may add another)
  });

  it("drops the fiction-only country subject for a non-fiction genre", async () => {
    let query = "";
    mockFetch((url) => {
      if (url.includes("openlibrary.org/search.json")) {
        query = qOf(url);
        return jsonOk({ numFound: 1, docs: [DOC] });
      }
      return undefined;
    });

    await getRandomBook({ country: "IN", genres: ["Non-fiction"], query: "physics" });

    // "Indic fiction" would contradict non-fiction → country dropped; Nonfiction + text remain.
    expect(query).toBe('subject:"Nonfiction" physics');
  });

  it("seeds a random subject only when there's nothing to search", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    let query = "";
    mockFetch((url) => {
      if (url.includes("openlibrary.org/search.json")) {
        query = qOf(url);
        return jsonOk({ numFound: 1, docs: [DOC] });
      }
      return undefined;
    });

    await getRandomBook({});

    expect(query).toMatch(/^subject:"/);
  });

  it("filters by decade (query) and minimum rating (client-side)", async () => {
    let query = "";
    mockFetch((url) => {
      if (url.includes("openlibrary.org/search.json")) {
        query = qOf(url);
        return jsonOk({
          numFound: 2,
          docs: [
            { ...DOC, key: "/works/HIGH", ratings_average: 4.6 },
            { ...DOC, key: "/works/LOW", ratings_average: 3.1 },
          ],
        });
      }
      return undefined;
    });

    const s = await getRandomBook({ genres: ["Sci-Fi"], decade: 1990, minRating: 4 });

    expect(query).toContain("first_publish_year:[1990 TO 1999]");
    expect(s.id).toBe("openlib:HIGH"); // only the 4.6 book clears the 4+ filter
  });

  it("applies the country as a nationality subject (Korea → Korean fiction) and stacks with genre", async () => {
    let url0 = "";
    mockFetch((url) => {
      if (url.includes("openlibrary.org/search.json")) {
        url0 ||= url; // PRIMARY query (a sparse pool may also fire a relaxed one)
        return jsonOk({ numFound: 1, docs: [DOC] });
      }
      return undefined;
    });

    await getRandomBook({ country: "KR", genres: ["Mystery"] });

    // Country + genre → the national genre heading "Detective and mystery stories, Korean"…
    expect(qOf(url0)).toBe('subject:"Detective and mystery stories, Korean"');
    // …and the edition language stays English (not Korean translations of bestsellers).
    expect(new URL(url0).searchParams.get("language")).toBe("eng");
  });
});
