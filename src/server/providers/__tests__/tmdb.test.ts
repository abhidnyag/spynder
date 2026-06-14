import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRandomTitle, vibeGenreHints } from "../tmdb";
import { clearCandidateCache } from "../cache";
import { jsonOk, mockFetch } from "./fetchMock";

const GENRES = {
  genres: [
    { id: 35, name: "Comedy" },
    { id: 53, name: "Thriller" },
    { id: 878, name: "Science Fiction" },
    { id: 18, name: "Drama" },
    { id: 10749, name: "Romance" },
  ],
};

beforeEach(() => {
  process.env.TMDB_API_KEY = "test-key";
});
afterEach(() => {
  vi.restoreAllMocks();
  clearCandidateCache();
});

describe("vibeGenreHints", () => {
  it("maps mood words to genre chips", () => {
    expect(vibeGenreHints("feel-good comedy")).toContain("Comedy");
    expect(vibeGenreHints("tense and gritty")).toContain("Thriller");
    expect(vibeGenreHints("mind-bending sci-fi")).toContain("Sci-Fi");
  });

  it("returns nothing for words with no mood mapping", () => {
    expect(vibeGenreHints("a quiet boring afternoon")).toEqual([]);
  });
});

describe("getRandomTitle — a typed vibe", () => {
  it("discovers by keyword + genre and NEVER uses title search", async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      calls.push(url);
      if (url.includes("/genre/movie/list")) return jsonOk(GENRES);
      if (url.includes("/search/keyword")) return jsonOk({ results: [{ id: 9999 }] });
      if (url.includes("/discover/movie"))
        return jsonOk({ total_pages: 1, results: [{ id: 42, title: "Some Comedy", vote_average: 7, overview: "x", poster_path: "/p.jpg", release_date: "2020-01-01" }] });
      if (url.includes("append_to_response"))
        return jsonOk({ id: 42, title: "Some Comedy", vote_average: 7.2, overview: "funny", genres: [{ id: 35, name: "Comedy" }], runtime: 100, release_date: "2020-01-01" });
      return undefined;
    });

    const s = await getRandomTitle({ type: "movie", query: "feel-good comedy" });

    expect(s.id).toBe("tmdb:movie:42");
    expect(s.title).toBe("Some Comedy");
    expect(calls.some((u) => u.includes("/search/keyword"))).toBe(true);
    expect(calls.some((u) => u.includes("/discover/movie"))).toBe(true);
    // The bug this fixes: vibe text must not hit the title-search endpoints.
    expect(calls.some((u) => u.includes("/search/movie") || u.includes("/search/tv"))).toBe(false);
  });

  it("falls back to a popular discover when nothing resolves (never dead-ends)", async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      calls.push(url);
      if (url.includes("/genre/movie/list")) return jsonOk(GENRES);
      if (url.includes("/search/keyword")) return jsonOk({ results: [] });
      if (url.includes("/discover/movie"))
        return jsonOk({ total_pages: 1, results: [{ id: 7, title: "Popular Pick", vote_average: 8, overview: "x", poster_path: null, release_date: "2021" }] });
      if (url.includes("append_to_response"))
        return jsonOk({ id: 7, title: "Popular Pick", vote_average: 8, overview: "", genres: [], release_date: "2021" });
      return undefined;
    });

    const s = await getRandomTitle({ type: "movie", query: "qwxyz nonsense words" });

    expect(s.id).toBe("tmdb:movie:7");
    expect(calls.some((u) => u.includes("/discover/movie"))).toBe(true);
    expect(calls.some((u) => u.includes("/search/movie") || u.includes("/search/tv"))).toBe(false);
  });
});
