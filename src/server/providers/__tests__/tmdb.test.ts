import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearGenreCache, getRandomTitle, vibeGenreHints } from "../tmdb";
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
  clearGenreCache();
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

describe("getRandomTitle — region-aware providers", () => {
  const watchProviders = {
    results: {
      US: { link: "https://tmdb/watch?locale=US", flatrate: [{ provider_name: "Netflix" }] },
      IN: { link: "https://tmdb/watch?locale=IN", flatrate: [{ provider_name: "JioHotstar" }] },
    },
  };

  const mockDetails = () =>
    mockFetch((url) => {
      if (url.includes("/genre/movie/list")) return jsonOk(GENRES);
      if (url.includes("/discover/movie"))
        return jsonOk({ total_pages: 1, results: [{ id: 5, title: "T", vote_average: 8, overview: "x", poster_path: null, release_date: "2020" }] });
      if (url.includes("append_to_response"))
        return jsonOk({ id: 5, title: "T", vote_average: 8, overview: "", genres: [], release_date: "2020", "watch/providers": watchProviders });
      return undefined;
    });

  it("surfaces the requested region's providers and watch link", async () => {
    mockDetails();
    const s = await getRandomTitle({ type: "movie" }, "IN");
    expect(s.providers).toEqual(["JioHotstar"]);
    expect(s.providerUrl).toBe("https://tmdb/watch?locale=IN");
  });

  it("falls back to US when the title isn't listed in the region", async () => {
    mockDetails();
    const s = await getRandomTitle({ type: "movie" }, "FR");
    expect(s.providers).toEqual(["Netflix"]);
    expect(s.providerUrl).toBe("https://tmdb/watch?locale=US");
  });

  it("still returns a pick from the discover row when the details call fails (no dead-end)", async () => {
    // Simulate a TMDB 429/timeout on the per-spin details call: it must NOT throw the whole
    // spin (which would dead-end a country filter to the seed → null → "no more results").
    mockFetch((url) => {
      if (url.includes("/genre/movie/list")) return jsonOk(GENRES);
      if (url.includes("/discover/movie"))
        return jsonOk({ total_pages: 1, results: [{ id: 77, title: "Discover Title", vote_average: 8.4, overview: "from discover", poster_path: "/d.jpg", release_date: "1995-06-01" }] });
      if (url.includes("append_to_response")) return { ok: false, status: 429 }; // details fails (rate limited)
      return undefined;
    });

    const s = await getRandomTitle({ type: "movie", country: "IN", decade: 1990 }, "IN");

    // Built from the discover data we already had — full pick, just without enriched fields.
    expect(s.id).toBe("tmdb:movie:77");
    expect(s.title).toBe("Discover Title");
    expect(s.year).toBe(1995);
    expect(s.rating).toBe(8.4);
    expect(s.synopsis).toBe("from discover");
    expect(s.imageUrl).toContain("/d.jpg");
    expect(s.genres).toEqual([]); // enriched-only fields degrade gracefully
    expect(s.cast).toEqual([]);
    expect(s.trailerUrl).toBeNull();
  });
});

describe("getRandomTitle — decade & rating filters", () => {
  it("constrains /discover by release-date window and vote_average floor", async () => {
    let discover = "";
    mockFetch((url) => {
      if (url.includes("/genre/movie/list")) return jsonOk(GENRES);
      if (url.includes("/discover/movie")) {
        discover = url;
        return jsonOk({ total_pages: 1, results: [{ id: 9, title: "X", vote_average: 8, overview: "", poster_path: null, release_date: "1995" }] });
      }
      if (url.includes("append_to_response"))
        return jsonOk({ id: 9, title: "X", vote_average: 8, overview: "", genres: [], release_date: "1995" });
      return undefined;
    });

    await getRandomTitle({ type: "movie", decade: 1990, minRating: 7 });

    const qs = decodeURIComponent(discover);
    expect(qs).toContain("primary_release_date.gte=1990-01-01");
    expect(qs).toContain("primary_release_date.lte=1999-12-31");
    expect(qs).toContain("vote_average.gte=7");
  });

  it("restricts discover to an origin country", async () => {
    let discover = "";
    mockFetch((url) => {
      if (url.includes("/genre/movie/list")) return jsonOk(GENRES);
      if (url.includes("/discover/movie")) {
        discover = url;
        return jsonOk({ total_pages: 1, results: [{ id: 3, title: "K", vote_average: 8, overview: "", poster_path: null, release_date: "2018" }] });
      }
      if (url.includes("append_to_response"))
        return jsonOk({ id: 3, title: "K", vote_average: 8, overview: "", genres: [], release_date: "2018" });
      return undefined;
    });

    await getRandomTitle({ type: "movie", country: "KR" });

    expect(decodeURIComponent(discover)).toContain("with_origin_country=KR");
  });

  const mockDiscover = (urls: string[], results: (url: string) => unknown[]) =>
    mockFetch((url) => {
      if (url.includes("/genre/movie/list")) return jsonOk(GENRES);
      if (url.includes("/discover/movie")) {
        urls.push(decodeURIComponent(url));
        return jsonOk({ total_pages: 1, results: results(url) });
      }
      if (url.includes("append_to_response"))
        return jsonOk({ id: 0, title: "T", vote_average: 7, overview: "", genres: [], release_date: "2015" });
      return undefined;
    });
  // A pool ≥ MIN_POOL (20) so the thin-pool relaxation does NOT trigger.
  const rich = () => Array.from({ length: 20 }, (_, i) => ({ id: i, title: `T${i}`, vote_average: 7, overview: "", poster_path: null, release_date: "2015" }));
  const sparse = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 900 + i, title: `S${i}`, vote_average: 7, overview: "", poster_path: null, release_date: "1965" }));

  it("uses the high popularity floor for big markets (US) and the low floor for regional ones (KR)", async () => {
    const floorFor = async (country: string) => {
      const urls: string[] = [];
      mockFetch((url) => {
        if (url.includes("/genre/movie/list")) return jsonOk(GENRES);
        if (url.includes("/genre/tv/list")) return jsonOk({ genres: [{ id: 35, name: "Comedy" }] });
        if (url.includes("/discover/")) {
          urls.push(decodeURIComponent(url));
          return jsonOk({ total_pages: 1, results: rich() }); // ≥ MIN_POOL → no grow relaxation
        }
        if (url.includes("append_to_response")) return jsonOk({ id: 0, title: "T", vote_average: 7, overview: "", genres: [], release_date: "1995" });
        return undefined;
      });
      await getRandomTitle({ type: "movie", country, genres: ["Comedy"], decade: 1990 });
      clearCandidateCache();
      clearGenreCache();
      return urls;
    };

    // US (the mainstream catalogue) keeps the high floor so obscure low-vote junk is filtered.
    expect((await floorFor("US")).some((u) => u.includes("vote_count.gte=200"))).toBe(true);
    // KR (a smaller regional catalogue) uses the relaxed floor so it doesn't dead-end.
    const kr = await floorFor("KR");
    expect(kr.some((u) => u.includes("vote_count.gte=20") && !u.includes("vote_count.gte=200"))).toBe(true);
  });

  it("refines an India pick by Hindi (Bollywood) on top of the origin-country filter", async () => {
    const urls: string[] = [];
    mockDiscover(urls, rich); // rich pool (≥ MIN_POOL) → no relaxation, the language constraint stands

    await getRandomTitle({ type: "movie", country: "IN" });

    expect(urls.some((u) => u.includes("with_origin_country=IN") && u.includes("with_original_language=hi"))).toBe(true);
    // The language is never dropped when the pool is already healthy.
    expect(urls.some((u) => u.includes("with_origin_country=IN") && !u.includes("with_original_language"))).toBe(false);
  });

  it("grows a thin Hindi pool by relaxing the popularity floor, keeping the language", async () => {
    const urls: string[] = [];
    // The default floor (vote_count.gte=20) is sparse for an old decade; lowering it to 5
    // with the SAME language fills the pool, so the Hindi filter is preserved.
    mockDiscover(urls, (url) =>
      new URL(url).searchParams.get("vote_count.gte") === "20" ? sparse(2) : rich(),
    );

    await getRandomTitle({ type: "movie", country: "IN", decade: 1960 });

    // A relaxed-floor query fired that STILL carries the Hindi + origin constraints…
    expect(urls.some((u) => u.includes("vote_count.gte=5") && u.includes("with_original_language=hi") && u.includes("with_origin_country=IN"))).toBe(true);
    // …and the language was NOT dropped (lowering the floor alone was enough).
    expect(urls.some((u) => u.includes("with_origin_country=IN") && !u.includes("with_original_language"))).toBe(false);
  });

  it("prefers the richer kind when type isn't pinned (Indian 1990s: films over the tiny series pool)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9); // pickKind(["movie","tv"]) → "tv" first
    const urls: string[] = [];
    mockFetch((url) => {
      if (url.includes("/genre/")) return jsonOk(GENRES);
      if (url.includes("/discover/tv")) { urls.push("tv"); return jsonOk({ total_pages: 1, results: sparse(3) }); }
      if (url.includes("/discover/movie")) { urls.push("movie"); return jsonOk({ total_pages: 1, results: rich() }); }
      if (url.includes("append_to_response"))
        return jsonOk({ id: 0, title: "Film", vote_average: 7, overview: "", genres: [], runtime: 120, release_date: "1995" });
      return undefined;
    });

    const s = await getRandomTitle({ country: "IN", decade: 1990 }, "IN");

    // Random kind was "tv" (thin), so it switched to the far richer movie catalogue.
    expect(urls).toContain("movie");
    expect(s.type).toBe("movie");
    expect(s.id.startsWith("tmdb:movie:")).toBe(true);
  });

  it("steers an unpinned genre spin to the kind that supports it (Thriller → movie, not series)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9); // pickKind would pick "tv" if unconstrained
    // TMDB's TV genre list has no "Thriller" — so the genre only maps for movies.
    const TV_GENRES = { genres: [{ id: 18, name: "Drama" }, { id: 10765, name: "Sci-Fi & Fantasy" }] };
    const urls: string[] = [];
    mockFetch((url) => {
      if (url.includes("/genre/movie/list")) return jsonOk(GENRES);
      if (url.includes("/genre/tv/list")) return jsonOk(TV_GENRES);
      if (url.includes("/discover/tv")) { urls.push("TV-DISCOVER"); return jsonOk({ total_pages: 1, results: [] }); }
      if (url.includes("/discover/movie")) { urls.push(decodeURIComponent(url)); return jsonOk({ total_pages: 1, results: rich() }); }
      if (url.includes("append_to_response"))
        return jsonOk({ id: 0, title: "Th", vote_average: 7, overview: "", genres: [], runtime: 110, release_date: "1995" });
      return undefined;
    });

    const s = await getRandomTitle({ genres: ["Thriller"], country: "IN", decade: 1990 }, "IN");

    // Genre maps only for movies → the spin is steered to a film, and the series catalogue
    // (which would silently ignore the genre) is never queried.
    expect(s.type).toBe("movie");
    expect(urls).not.toContain("TV-DISCOVER");
    expect(urls.some((u) => u.includes("with_genres=53"))).toBe(true); // Thriller id applied
  });

  it("applies a loose TV genre fallback for a pinned Series + Thriller (→ Crime/Mystery)", async () => {
    const TV_GENRES = { genres: [{ id: 80, name: "Crime" }, { id: 9648, name: "Mystery" }, { id: 18, name: "Drama" }] };
    const urls: string[] = [];
    mockFetch((url) => {
      if (url.includes("/genre/movie/list")) return jsonOk(GENRES);
      if (url.includes("/genre/tv/list")) return jsonOk(TV_GENRES);
      if (url.includes("/discover/movie")) { urls.push("MOVIE-DISCOVER"); return jsonOk({ total_pages: 1, results: [] }); }
      if (url.includes("/discover/tv")) { urls.push(decodeURIComponent(url)); return jsonOk({ total_pages: 1, results: rich() }); }
      if (url.includes("append_to_response"))
        return jsonOk({ id: 0, title: "Show", vote_average: 7, overview: "", genres: [], release_date: "2015" });
      return undefined;
    });

    const s = await getRandomTitle({ type: "series", genres: ["Thriller"] });

    // Pinned series is honoured; Thriller (no TV genre) falls back to Crime + Mystery.
    expect(s.type).toBe("series");
    expect(urls).not.toContain("MOVIE-DISCOVER");
    expect(urls.some((u) => u.includes("with_genres=80,9648"))).toBe(true);
  });

  it("drops the language as a last resort for a genuinely tiny catalogue", async () => {
    const urls: string[] = [];
    // Even at the relaxed floor the language stays sparse (2); only origin-country fills it.
    mockDiscover(urls, (url) => (url.includes("with_original_language") ? sparse(2) : rich()));

    await getRandomTitle({ type: "movie", country: "IN", decade: 1950 });

    // The language attempts fire first, then it's dropped for an origin-country-only query.
    expect(urls.some((u) => u.includes("with_original_language=hi"))).toBe(true);
    expect(urls.some((u) => u.includes("with_origin_country=IN") && !u.includes("with_original_language"))).toBe(true);
  });
});
