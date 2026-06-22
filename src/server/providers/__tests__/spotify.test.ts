import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRateLimit, fetchTrackPreview, getRandomTrack, SIBLING_TAGS, vibeGenreTag } from "../spotify";
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
  clearRateLimit(); // close the rate-limit breaker so a tripped 429 doesn't leak into the next test
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
  it("maps a description's mood word to a tag AND searches the description as free text", async () => {
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
    expect(queries).toContain('genre:"jazz"'); // the mood word "jazz" still maps to a genre tag
    expect(queries).toContain("romantic dinner jazz"); // AND the description is searched as a theme
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

  it("searches a genre chip as a tag and ALSO searches the description as free text", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        queries.push(decodeURIComponent(search(url).get("q") ?? ""));
        return jsonOk({ tracks: { items: tracks(10, `x${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ genres: ["Jazz"], query: "smooth late night" });

    expect(queries).toContain('genre:"jazz"'); // the genre chip → genre tag
    expect(queries).toContain("smooth late night"); // the description → free-text theme search
  });

  it("blends a genre chip, the mapped mood, and the description free-text search", async () => {
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

    // Rock chip + "energetic" (→ workout tag): both genre tags, plus the free-text description.
    await getRandomTrack({ genres: ["Rock"], query: "energetic" });

    expect(queries).toContain('genre:"rock"');
    expect(queries).toContain('genre:"workout"');
    expect(queries).toContain("energetic"); // description also searched as free text
  });

  it("folds an adjacent genre into a broad genre chip so crossovers surface (Blues → also blues-rock)", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        queries.push(decodeURIComponent(search(url).get("q") ?? ""));
        return jsonOk({ tracks: { items: tracks(10, `b${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ genres: ["Blues"], country: "US" });

    expect(queries).toContain('genre:"blues"'); // the chip's own genre
    expect(queries).toContain('genre:"blues-rock"'); // adjacent genre always blended in
  });

  it("resolves a MUSIC sub-genre label to its Spotify genre seed (Punk Rock → punk)", async () => {
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

    await getRandomTrack({ subgenres: ["Punk Rock"] });

    expect(queries).toContain('genre:"punk"'); // the sub-genre's seed, not its label
  });

  it("uses a country-specific sub-genre as the local-scene anchor keyword (India + Bhangra → bhangra in IN)", async () => {
    const queries: { q: string; market: string }[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        const sp = search(url);
        queries.push({ q: decodeURIComponent(sp.get("q") ?? ""), market: sp.get("market") ?? "" });
        return jsonOk({ tracks: { items: tracks(10, `b${sp.get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ country: "IN", subgenres: ["Bhangra"] });

    // The India default keyword is "bollywood"; the chosen sub-genre overrides it.
    expect(queries.every((x) => x.market === "IN")).toBe(true);
    expect(queries.some((x) => x.q.includes("bhangra"))).toBe(true);
    expect(queries.some((x) => x.q.includes("bollywood"))).toBe(false);
  });

  it("maps the R&B genre chip to Spotify's r-n-b seed (not the literal 'r&b')", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        queries.push(decodeURIComponent(search(url).get("q") ?? ""));
        return jsonOk({ tracks: { items: tracks(10, `r${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ genres: ["R&B"] });

    expect(queries).toContain('genre:"r-n-b"');
  });

  it("searches a free-form description as free text — NOT a random genre — with filler dropped", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        queries.push(decodeURIComponent(search(url).get("q") ?? ""));
        return jsonOk({ tracks: { items: tracks(10, `${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    // "summer vibes" maps to no genre/mood tag — it must be searched as a theme, not fall back to
    // a random genre. "vibes" is filler → dropped.
    await getRandomTrack({ query: "summer vibes" });

    expect(queries.every((q) => q === "summer")).toBe(true);
    expect(queries.some((q) => q.includes("genre:"))).toBe(false); // never a random genre tag
  });

  it("scopes a description's free-text search by the decade", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        queries.push(decodeURIComponent(search(url).get("q") ?? ""));
        return jsonOk({ tracks: { items: tracks(10, `${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ query: "road trip", decade: 2010 });

    expect(queries.every((q) => q === "road trip year:2010-2019")).toBe(true);
  });

  it("refines a mapped country by the description's MAPPED mood tag, not its raw words (no English leak)", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        queries.push(decodeURIComponent(search(url).get("q") ?? ""));
        return jsonOk({ tracks: { items: tracks(10, `${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    // Japan + a description: the raw English words ("rainy"/"night"/"study") must NOT be appended
    // (they pull English tracks and break the j-pop anchor); only the mapped mood tag (chill) does.
    await getRandomTrack({ query: "rainy night study", country: "JP" });

    expect(queries.every((q) => q.startsWith("j-pop"))).toBe(true); // stays in the local scene
    expect(queries).toContain("j-pop chill"); // "rainy" → chill mood tag
    expect(queries.some((q) => /rainy|night|study/.test(q))).toBe(false); // no raw English words
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

    clearCandidateCache();
    const jp = await run({ country: "JP" }); // only-country filter → bare keyword
    expect(jp.every((c) => c.market === "JP" && c.q === "j-pop")).toBe(true);

    clearCandidateCache();
    const it = await run({ country: "IT", decade: 2010 });
    expect(it.every((c) => c.market === "IT" && c.q === "italian pop year:2010-2019")).toBe(true);

    clearCandidateCache();
    const cn = await run({ country: "CN" });
    expect(cn.every((c) => c.q === "mandopop")).toBe(true); // mandopop, NOT "c-pop" (that → English)
  });

  it("drops tracks literally titled after the keyword (Japan: the 'J-POP'-named junk)", async () => {
    const real = { ...track("real"), name: "幾億光年" }; // real J-pop (native-language name)
    const junk = { ...track("junk"), name: "J-POP" }; // literal-title junk a free-text search ranks high
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) return jsonOk({ tracks: { items: [real, junk] } });
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    const s = await getRandomTrack({ country: "JP" });

    expect(s.id).toBe("spotify:real"); // the "J-POP"-named track is filtered out
    expect(s.title).not.toBe("J-POP");
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

describe("getRandomTrack — deep paging (large unique pool)", () => {
  it("pages deep so a filtered pool yields far more than the old ~40 unique tracks before repeating", async () => {
    // 30 full pages (300 distinct) then the result set ends (empty page).
    const FULL_PAGES = 30;
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        const offset = Number(search(url).get("offset"));
        return offset / 10 < FULL_PAGES
          ? jsonOk({ tracks: { items: tracks(10, `o${offset}_`) } }) // distinct ids per page
          : jsonOk({ tracks: { items: [] } }); // exhausted
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    // Spin many times on the SAME filter (one cached pool) — every spin should be a NEW track
    // until the pool is exhausted, well past the old 4-page (~40) ceiling.
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) seen.add((await getRandomTrack({ genres: ["Pop"] })).id);

    expect(seen.size).toBeGreaterThan(100); // far beyond the old ~40-track cap
  });

  it("stops paging as soon as Spotify returns a short page — no requests past the end of results", async () => {
    const offsets: number[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        const offset = Number(search(url).get("offset"));
        offsets.push(offset);
        // A short page (< SEARCH_LIMIT) lands in the first batch → paging must stop, never
        // reaching deep into the 50-page ceiling.
        return offset === 0
          ? jsonOk({ tracks: { items: tracks(10, "a") } })
          : jsonOk({ tracks: { items: tracks(3, `b${offset}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ genres: ["Pop"] });

    expect(offsets.some((o) => o >= 100)).toBe(false); // never paged near the ceiling
  });

  it("stops paging when a whole batch adds no new tracks (Spotify repeating the same items)", async () => {
    const offsets: number[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        offsets.push(Number(search(url).get("offset")));
        return jsonOk({ tracks: { items: tracks(10, "same") } }); // identical 10 ids every page
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ genres: ["Pop"] });

    // First batch fills the pool; the second adds nothing new → stop. Never near the ceiling.
    expect(offsets.length).toBeLessThanOrEqual(10);
  });
});

describe("getRandomTrack — rate-limit circuit breaker (429)", () => {
  it("trips on a 429, then makes NO further API calls while open, and resumes once closed", async () => {
    let searchCalls = 0;
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        searchCalls += 1;
        return { ok: false, status: 429, headers: { "retry-after": "120" }, json: { tracks: { items: [] } } };
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    // First spin: the burst hits a 429, trips the breaker, and falls back (empty pool → throws).
    await expect(getRandomTrack({ genres: ["Pop"] })).rejects.toThrow();
    const afterFirst = searchCalls;
    expect(afterFirst).toBeGreaterThan(0);

    // Second spin (a DIFFERENT filter, so not merely a cache hit): breaker open → zero new calls.
    await expect(getRandomTrack({ genres: ["Rock"] })).rejects.toThrow();
    expect(searchCalls).toBe(afterFirst);

    // Once the breaker is closed (Retry-After elapsed), Spotify is called again and the spin works.
    clearRateLimit();
    clearCandidateCache(); // drop the briefly-cached empty pools from the throttle
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        searchCalls += 1;
        return jsonOk({ tracks: { items: tracks(10, `r${search(url).get("offset")}_`) } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    const s = await getRandomTrack({ genres: ["Jazz"] });
    expect(s.source).toBe("spotify");
    expect(searchCalls).toBeGreaterThan(afterFirst);
  });
});
