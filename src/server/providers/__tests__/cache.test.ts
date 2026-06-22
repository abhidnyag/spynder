import { afterEach, describe, expect, it } from "vitest";
import { cachedPool, clearCandidateCache, pickUnseen } from "../cache";

afterEach(() => clearCandidateCache());

const id = (n: number) => String(n);

describe("pickUnseen — no repeat until the pool is exhausted", () => {
  it("returns every item exactly once before any repeat (pool larger than the recent window)", () => {
    const items = Array.from({ length: 30 }, (_, i) => i + 1); // 30 > RECENT_WINDOW (15)
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) seen.push(id(pickUnseen("k", items, id)));
    expect(new Set(seen).size).toBe(30); // all distinct — the whole pool was exhausted
  });

  it("exhausts the pool from the recent-window alone when the served set is cold (fresh process)", () => {
    // Simulates a deployment where the in-memory served set doesn't persist (serverless / a
    // fresh process each request): the DB-backed recent window must still drive the no-repeat.
    const items = Array.from({ length: 60 }, (_, i) => i + 1);
    const window: string[] = [];
    const seen = new Set<string>();
    for (let s = 0; s < 60; s++) {
      clearCandidateCache(); // wipe the served set every spin → recent-window is the only guard
      const recent = new Set(window.slice(-80)); // RECENT_WINDOW (80) ≥ pool (60)
      const pick = id(pickUnseen("k", items, id, recent));
      window.push(pick);
      seen.add(pick);
    }
    expect(seen.size).toBe(60); // every title shown before any repeat
  });

  it("starts a fresh cycle once exhausted (a repeat is then allowed)", () => {
    const items = [1, 2, 3];
    const first = [pickUnseen("k", items, id), pickUnseen("k", items, id), pickUnseen("k", items, id)].map(id);
    expect(new Set(first).size).toBe(3); // cycle 1: all three
    const next = id(pickUnseen("k", items, id)); // cycle 2 begins
    expect(["1", "2", "3"]).toContain(next);
  });

  it("a new cycle still skips the recent picks passed via exclude", () => {
    const items = [1, 2, 3];
    const order = [pickUnseen("k", items, id), pickUnseen("k", items, id), pickUnseen("k", items, id)].map(id);
    // Pool exhausted; the recent window still excludes the very last pick on reset.
    const recent = new Set([order[2]]);
    const next = id(pickUnseen("k", items, id, recent));
    expect(next).not.toBe(order[2]);
  });

  it("tracks each filter (key) independently", () => {
    const items = [1, 2, 3];
    pickUnseen("a", items, id);
    pickUnseen("a", items, id);
    // A different filter starts its own fresh cycle — all three still available.
    const seenB = [pickUnseen("b", items, id), pickUnseen("b", items, id), pickUnseen("b", items, id)].map(id);
    expect(new Set(seenB).size).toBe(3);
  });

  it("keyless (pure-random) pools keep the simple recent-window behaviour", () => {
    const items = [1, 2, 3];
    const recent = new Set(["1", "2"]); // only 3 is fresh
    expect(id(pickUnseen(null, items, id, recent))).toBe("3");
  });

  it("rebuilding a pool resets its exhaustion cycle", async () => {
    const items = [1, 2, 3];
    const produce = async () => items;
    // First build + serve all three.
    await cachedPool("rk", produce);
    [1, 2, 3].forEach(() => pickUnseen("rk", items, id));
    // Force a rebuild (clear → produce again); the served set for this key resets.
    clearCandidateCache();
    await cachedPool("rk", produce);
    const seen = [pickUnseen("rk", items, id), pickUnseen("rk", items, id), pickUnseen("rk", items, id)].map(id);
    expect(new Set(seen).size).toBe(3);
  });
});

describe("cachedPool — does not cache an empty (transient-failure) pool", () => {
  it("re-runs produce() after an empty result instead of caching it for the TTL", async () => {
    let calls = 0;
    // First call returns [] (e.g. a Spotify 429 rate-limit), then the API recovers.
    const produce = async () => {
      calls += 1;
      return calls === 1 ? [] : [1, 2, 3];
    };

    const first = await cachedPool("ek", produce);
    expect(first).toEqual([]); // empty result still returned to the caller
    const second = await cachedPool("ek", produce);
    expect(second).toEqual([1, 2, 3]); // NOT served the cached [] — produce() ran again and recovered
    expect(calls).toBe(2);
  });

  it("caches a non-empty pool as normal (produce runs once)", async () => {
    let calls = 0;
    const produce = async () => {
      calls += 1;
      return [1, 2, 3];
    };
    await cachedPool("nk", produce);
    await cachedPool("nk", produce);
    expect(calls).toBe(1); // second call served from cache
  });

  it("caches an empty pool BRIEFLY when the caller opts in (e.g. a known rate-limit)", async () => {
    let calls = 0;
    const produce = async () => {
      calls += 1;
      return [] as number[];
    };
    // emptyTtlMs > 0 → the empty pool is cached, so a repeated spin doesn't re-run the
    // (still-throttled) producer. (Default — no emptyTtlMs — would re-run, per the test above.)
    const first = await cachedPool("rl", produce, () => 30_000);
    expect(first).toEqual([]);
    const second = await cachedPool("rl", produce, () => 30_000);
    expect(second).toEqual([]);
    expect(calls).toBe(1); // NOT re-run — served from the brief empty cache
  });

  it("does not cache an empty pool when emptyTtlMs resolves to 0 (breaker closed)", async () => {
    let calls = 0;
    const produce = async () => {
      calls += 1;
      return calls === 1 ? ([] as number[]) : [1, 2, 3];
    };
    await cachedPool("rl0", produce, () => 0); // 0 → behave like the default (don't cache empty)
    const second = await cachedPool("rl0", produce, () => 0);
    expect(second).toEqual([1, 2, 3]);
    expect(calls).toBe(2);
  });
});
