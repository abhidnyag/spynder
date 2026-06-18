import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTrackPreview, getRandomTrack, SIBLING_TAGS, vibeGenreTag } from "../spotify";
import { clearCandidateCache } from "../cache";
import { jsonOk, mockFetch } from "./fetchMock";

const track = (id: string) => ({
  id,
  name: `track-${id}`,
  preview_url: "http://preview", // truthy → no embed-scrape fetch
  external_urls: { spotify: "http://open" },
  artists: [{ id: `artist-${id}`, name: "Artist" }],
  album: { release_date: "2020", images: [{ url: "http://img" }] },
});
const tracks = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => track(`${prefix}${i}`));
const search = (url: string) => new URL(url).searchParams;
const tokenRoute = (url: string) => (url.includes("/api/token") ? jsonOk({ access_token: "tok", expires_in: 3600 }) : undefined);

beforeEach(() => {
  process.env.SPOTIFY_CLIENT_ID = "id";
  process.env.SPOTIFY_CLIENT_SECRET = "secret";
  // Deterministic Math.random so pickFresh's choice is stable across runs.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
  clearCandidateCache();
});

describe("vibeGenreTag", () => {
  it("maps moods to verified-good tags and avoids the junk ones", () => {
    expect(vibeGenreTag("Focus")).toBe("study");
    expect(vibeGenreTag("rainy sunday cleaning")).toBe("chill");
    expect(vibeGenreTag("energetic workout")).toBe("workout");
    expect(vibeGenreTag("Sad")).toBe("acoustic"); // not the junk "sad" tag
    expect(vibeGenreTag("Romantic")).toBe("jazz"); // not the junk "romance" tag
    expect(vibeGenreTag("Party")).toBe("dance"); // not "party" (that tag returns German Schlager)
    expect(vibeGenreTag("xyzzy")).toBeNull();
  });
});

describe("fetchTrackPreview (lazy)", () => {
  it("scrapes the embed page for the 30-sec preview mp3 and unescapes the url", async () => {
    mockFetch((url) =>
      url.includes("/embed/track/abc")
        ? { text: 'x{"audioPreview":{"url":"https:\\u002F\\u002Fp.scdn.co\\u002Fmp3\\u002Fx"}}y' }
        : undefined,
    );
    expect(await fetchTrackPreview("abc")).toBe("https://p.scdn.co/mp3/x");
  });

  it("returns null when the page has no preview", async () => {
    mockFetch(() => ({ text: "<html>no preview here</html>" }));
    expect(await fetchTrackPreview("abc")).toBeNull();
  });
});

describe("getRandomTrack — a typed vibe", () => {
  it("uses the mood tag as a genre filter (no title-matching the free text)", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        queries.push(decodeURIComponent(search(url).get("q") ?? ""));
        return jsonOk({ tracks: { items: tracks(10, `j${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: ["jazz"] });
      return undefined;
    });

    const s = await getRandomTrack({ query: "romantic dinner jazz" });

    expect(s.source).toBe("spotify");
    // Every query is a bare mood-genre filter — the descriptive words are never appended.
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((q) => q === 'genre:"jazz"')).toBe(true);
  });

  it("widens a thin mood pool with sibling tags", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        const q = decodeURIComponent(search(url).get("q") ?? "");
        queries.push(q);
        if (q === 'genre:"study"') return jsonOk({ tracks: { items: tracks(4, "s") } }); // thin pool
        if (q === 'genre:"lo-fi"') return jsonOk({ tracks: { items: tracks(10, "l") } });
        if (q === 'genre:"ambient"') return jsonOk({ tracks: { items: tracks(10, "a") } });
        return jsonOk({ tracks: { items: [] } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ query: "focus study" });

    expect(SIBLING_TAGS.study).toEqual(["lo-fi", "ambient"]);
    expect(queries).toContain('genre:"study"');
    expect(queries).toContain('genre:"lo-fi"'); // widened: study (4) < 15
    expect(queries).toContain('genre:"ambient"');
  });

  it("does NOT widen a well-populated mood pool", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        const q = decodeURIComponent(search(url).get("q") ?? "");
        queries.push(q);
        // distinct ids per offset → two pulls give a 20-track pool (≥ 15)
        return jsonOk({ tracks: { items: tracks(10, `j${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ query: "romantic dinner jazz" });

    expect(queries).toContain('genre:"jazz"');
    expect(queries.some((q) => q.includes("soul") || q.includes("lounge"))).toBe(false);
  });

  it("searches the genre chip as a tag and never appends the free text", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        queries.push(decodeURIComponent(search(url).get("q") ?? ""));
        // distinct ids per offset → a 20-track pool (≥ 15), so no sibling widening
        return jsonOk({ tracks: { items: tracks(10, `x${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ genres: ["Jazz"], query: "smooth late night" });

    // The descriptive words must never reach Spotify as keywords (that title-matched).
    expect(queries.every((q) => q === 'genre:"jazz"')).toBe(true);
    expect(queries.some((q) => /smooth|late|night/.test(q))).toBe(false);
  });

  it("blends a genre chip and a mood from the description into both tag pools", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        const q = decodeURIComponent(search(url).get("q") ?? "");
        queries.push(q);
        return jsonOk({ tracks: { items: tracks(10, `${q}${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    // Rock chip + "energetic" (→ workout tag): both genre tags should be searched.
    await getRandomTrack({ genres: ["Rock"], query: "energetic" });

    expect(queries).toContain('genre:"rock"');
    expect(queries).toContain('genre:"workout"');
    expect(queries.some((q) => /energetic/.test(q))).toBe(false);
  });

  it("appends a year: range for a decade filter", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        queries.push(decodeURIComponent(search(url).get("q") ?? ""));
        return jsonOk({ tracks: { items: tracks(10, `p${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ genres: ["Pop"], decade: 1990 });

    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((q) => q === 'genre:"pop" year:1990-1999')).toBe(true);
  });

  it("India + decade searches the free-text `bollywood` keyword + year: in the IN market (popular Hindi)", async () => {
    const calls: { q: string; market: string }[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        const p = search(url);
        calls.push({ q: decodeURIComponent(p.get("q") ?? ""), market: p.get("market") ?? "" });
        return jsonOk({ tracks: { items: tracks(10, `${p.get("q")}${p.get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ country: "IN", decade: 1990 });

    // Free-text `bollywood year:1990-1999` (verified live to return popular 90s Hindi), in the IN
    // market — NOT the `genre:"bollywood"` operator (obscure long-tail), and no artist-genre lookup
    // (Spotify returns empty genres for Bollywood artists, which broke the decade filter).
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.market === "IN")).toBe(true);
    expect(calls.every((c) => c.q === "bollywood year:1990-1999")).toBe(true);
    expect(calls.some((c) => c.q.includes("genre:"))).toBe(false); // never the genre: operator
  });

  it("India + vibe refines the bollywood keyword by the vibe word (not the global mood tag)", async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        const p = search(url);
        calls.push(decodeURIComponent(p.get("q") ?? ""));
        return jsonOk({ tracks: { items: tracks(10, `${p.get("q")}${p.get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ vibes: ["Sad"], country: "IN" });

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((q) => q === "bollywood sad")).toBe(true);
    // The generic mood mapping (sad → acoustic) must NOT be used for India.
    expect(calls.some((q) => q.includes("acoustic"))).toBe(false);
  });

  it("India + vibe + decade combines the bollywood keyword + vibe word + year:", async () => {
    const calls: { q: string; market: string }[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        const p = search(url);
        calls.push({ q: decodeURIComponent(p.get("q") ?? ""), market: p.get("market") ?? "" });
        return jsonOk({ tracks: { items: tracks(10, `${p.get("q")}${p.get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    // The combo that previously didn't work at all.
    await getRandomTrack({ vibes: ["Sad"], country: "IN", decade: 1990 });

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.market === "IN")).toBe(true);
    expect(calls.every((c) => c.q === "bollywood sad year:1990-1999")).toBe(true);
  });

  it("India relaxes within bollywood (drops the decade) when an era is empty — never another genre", async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        const q = decodeURIComponent(search(url).get("q") ?? "");
        calls.push(q);
        // Year-scoped queries are empty; the decade-dropped bollywood search returns tracks.
        if (q.includes("year:")) return jsonOk({ tracks: { items: [] } });
        return jsonOk({ tracks: { items: tracks(10, `${q}${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    const s = await getRandomTrack({ vibes: ["Sad"], country: "IN", decade: 1940 });

    expect(s.source).toBe("spotify"); // resolves rather than dead-ending
    expect(calls).toContain("bollywood sad year:1940-1949"); // tried the decade first
    expect(calls).toContain("bollywood sad"); // relaxed to any era — still bollywood + sad
    // Crucially, EVERY query stayed the bollywood keyword — never a generic/global genre.
    expect(calls.every((q) => /^bollywood\b/.test(q))).toBe(true);
  });

  it("mapped countries anchor on their local-language keyword (Korea → k-pop, Spain → pop español)", async () => {
    const run = async (filter: Parameters<typeof getRandomTrack>[0]) => {
      const calls: { q: string; market: string }[] = [];
      mockFetch((url) => {
        const tok = tokenRoute(url);
        if (tok) return tok;
        if (url.includes("/search?type=track")) {
          const p = search(url);
          calls.push({ q: decodeURIComponent(p.get("q") ?? ""), market: p.get("market") ?? "" });
          return jsonOk({ tracks: { items: tracks(10, `${p.get("q")}${p.get("offset")}_`) } });
        }
        if (url.includes("/artists/")) return jsonOk({ genres: [] });
        return undefined;
      });
      await getRandomTrack(filter);
      return calls;
    };

    const kr = await run({ vibes: ["Sad"], country: "KR", decade: 2010 });
    expect(kr.every((c) => c.market === "KR")).toBe(true);
    expect(kr.every((c) => c.q === "k-pop sad year:2010-2019")).toBe(true);
    expect(kr.some((c) => c.q.includes("genre:"))).toBe(false); // free-text keyword, not genre:

    clearCandidateCache();
    const es = await run({ country: "ES", decade: 2000 });
    expect(es.every((c) => c.market === "ES")).toBe(true);
    expect(es.every((c) => c.q === "pop español year:2000-2009")).toBe(true);
  });

  it("an UNMAPPED country (US) keeps the generic genre+market+year search", async () => {
    const calls: { q: string; market: string }[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        const p = search(url);
        calls.push({ q: decodeURIComponent(p.get("q") ?? ""), market: p.get("market") ?? "" });
        return jsonOk({ tracks: { items: tracks(10, `${p.get("q")}${p.get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ genres: ["Rock"], country: "US", decade: 2010 });

    // US is unmapped → generic path: the genre tag, year-scoped, in the US market.
    expect(calls.every((c) => c.market === "US")).toBe(true);
    expect(calls.every((c) => c.q === 'genre:"rock" year:2010-2019')).toBe(true);
  });

  it("the Party vibe maps to genre:\"dance\" (not the broken \"party\" tag) for an unmapped country", async () => {
    const calls: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        calls.push(decodeURIComponent(search(url).get("q") ?? ""));
        return jsonOk({ tracks: { items: tracks(10, `${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ vibes: ["Party"], country: "US" });

    expect(calls.every((q) => q === 'genre:"dance"')).toBe(true);
    expect(calls.some((q) => q.includes('"party"'))).toBe(false);
  });
});
