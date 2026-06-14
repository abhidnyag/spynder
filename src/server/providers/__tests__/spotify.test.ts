import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRandomTrack, SIBLING_TAGS, vibeGenreTag } from "../spotify";
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
  // Deterministic random offset (rand(20) -> 10) so the two page pulls differ.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => vi.restoreAllMocks());

describe("vibeGenreTag", () => {
  it("maps moods to verified-good tags and avoids the junk ones", () => {
    expect(vibeGenreTag("Focus")).toBe("study");
    expect(vibeGenreTag("rainy sunday cleaning")).toBe("chill");
    expect(vibeGenreTag("energetic workout")).toBe("workout");
    expect(vibeGenreTag("Sad")).toBe("acoustic"); // not the junk "sad" tag
    expect(vibeGenreTag("Romantic")).toBe("jazz"); // not the junk "romance" tag
    expect(vibeGenreTag("xyzzy")).toBeNull();
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

  it("respects an explicit genre chip (no mood override) and keeps the free text", async () => {
    const queries: string[] = [];
    mockFetch((url) => {
      const tok = tokenRoute(url);
      if (tok) return tok;
      if (url.includes("/search?type=track")) {
        queries.push(decodeURIComponent(search(url).get("q") ?? ""));
        return jsonOk({ tracks: { items: tracks(10, "x") } });
      }
      if (url.includes("/artists/")) return jsonOk({ genres: [] });
      return undefined;
    });

    await getRandomTrack({ genres: ["Jazz"], query: "smooth late night" });

    expect(queries[0]).toBe('genre:"jazz" smooth late night');
    expect(queries.some((q) => q.includes("soul") || q.includes("lounge"))).toBe(false);
  });
});
