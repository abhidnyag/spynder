import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRandomBook } from "../books";
import { jsonOk, mockFetch } from "./fetchMock";

const VOLUME = {
  id: "vol1",
  volumeInfo: {
    title: "Dune",
    authors: ["Frank Herbert"],
    publishedDate: "1965-06-01",
    pageCount: 412,
    averageRating: 4.2,
    categories: ["Fiction / Science Fiction"],
    infoLink: "http://books.google/dune",
    imageLinks: { thumbnail: "http://img/dune" },
  },
};
const qOf = (url: string) => new URL(url).searchParams.get("q") ?? "";

beforeEach(() => {
  delete process.env.GOOGLE_BOOKS_API_KEY;
});
afterEach(() => vi.restoreAllMocks());

describe("getRandomBook", () => {
  it("maps a genre chip to a subject, searches the vibe text, and builds a Suggestion", async () => {
    let query = "";
    mockFetch((url) => {
      if (url.includes("googleapis.com/books")) {
        query = qOf(url);
        return jsonOk({ totalItems: 1, items: [VOLUME] });
      }
      return undefined;
    });

    const s = await getRandomBook({ genres: ["Sci-Fi"], query: "mind-bending" });

    // genre → subject, and the vibe is part of the query (Books searches descriptions).
    expect(query).toBe('subject:"Science Fiction" mind-bending');
    expect(s.id).toBe("gbooks:vol1");
    expect(s.mode).toBe("BOOK");
    expect(s.source).toBe("google_books");
    expect(s.title).toBe("Dune");
    expect(s.artist).toBe("Frank Herbert"); // author in the shared `artist` field
    expect(s.year).toBe(1965);
    expect(s.runtime).toBe("412 pages");
    expect(s.imageUrl).toBe("https://img/dune"); // upgraded to https
  });

  it("still searches the free-text vibe when no genre chip is given", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // deterministic random subject
    let query = "";
    mockFetch((url) => {
      if (url.includes("googleapis.com/books")) {
        query = qOf(url);
        return jsonOk({ totalItems: 1, items: [VOLUME] });
      }
      return undefined;
    });

    await getRandomBook({ query: "cozy mystery" });

    expect(query).toMatch(/^subject:"/); // a subject is always present
    expect(query).toContain("cozy mystery"); // and the vibe text is searched
  });
});
