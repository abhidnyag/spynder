import { afterEach, describe, expect, it, vi } from "vitest";
import { watchLinksForTmdb } from "../watchmode";
import { jsonOk, mockFetch } from "./fetchMock";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.WATCHMODE_API_KEY;
});

describe("watchLinksForTmdb", () => {
  it("returns nothing (and makes no call) without an API key", async () => {
    const fetchFn = mockFetch(() => undefined); // any call would throw "Unmocked fetch"
    const links = await watchLinksForTmdb(42, "movie", "US");
    expect(links).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("resolves one deep link per service, preferring a stream over rent/buy", async () => {
    process.env.WATCHMODE_API_KEY = "test-key";
    let requested = "";
    mockFetch((url) => {
      requested = url;
      return jsonOk([
        { source_id: 1, name: "Netflix", type: "sub", region: "US", web_url: "https://netflix.com/title/1" },
        { source_id: 2, name: "Apple TV", type: "buy", region: "US", web_url: "https://tv.apple.com/buy/2" },
        { source_id: 2, name: "Apple TV", type: "rent", region: "US", web_url: "https://tv.apple.com/rent/2" },
      ]);
    });

    const links = await watchLinksForTmdb(42, "movie", "us");

    expect(requested).toContain("/title/movie-42/sources/");
    // The `regions` param 400s on free plans, so it must not be sent.
    expect(requested).not.toContain("regions=");
    expect(links).toEqual([
      { name: "Netflix", url: "https://netflix.com/title/1" },
      { name: "Apple TV", url: "https://tv.apple.com/buy/2" },
    ]);
  });

  it("prefers the viewer's region but falls back to all when it isn't listed", async () => {
    process.env.WATCHMODE_API_KEY = "test-key";
    mockFetch(() =>
      jsonOk([
        { source_id: 1, name: "Netflix", type: "sub", region: "IN", web_url: "https://netflix.com/in/1" },
        { source_id: 2, name: "Hotstar", type: "sub", region: "IN", web_url: "https://hotstar.com/2" },
      ]),
    );

    // US has no sources here → fall back to the (IN) ones rather than show nothing.
    const links = await watchLinksForTmdb(42, "movie", "US");
    expect(links.map((l) => l.name)).toEqual(["Netflix", "Hotstar"]);
  });

  it("skips placeholder URLs from paid-only fields", async () => {
    process.env.WATCHMODE_API_KEY = "test-key";
    mockFetch(() =>
      jsonOk([{ source_id: 1, name: "Netflix", type: "sub", region: "US", web_url: "Deeplinks available for paid plans only." }]),
    );
    expect(await watchLinksForTmdb(42, "movie", "US")).toEqual([]);
  });

  it("fails soft to [] when the lookup errors", async () => {
    process.env.WATCHMODE_API_KEY = "test-key";
    mockFetch(() => ({ ok: false, status: 404 }));
    expect(await watchLinksForTmdb(99, "tv", "US")).toEqual([]);
  });
});
