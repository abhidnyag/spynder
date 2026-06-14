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

  it("searches the free-text vibe alone (no forced subject) when no genre chip is given", async () => {
    let query = "";
    mockFetch((url) => {
      if (url.includes("openlibrary.org/search.json")) {
        query = qOf(url);
        return jsonOk({ numFound: 1, docs: [DOC] });
      }
      return undefined;
    });

    await getRandomBook({ query: "cozy mystery" });

    // Relevance search on the vibe — not narrowed to a random subject.
    expect(query).toBe("cozy mystery");
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
});
