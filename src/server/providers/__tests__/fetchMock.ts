import { vi } from "vitest";

interface Reply {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

/**
 * Replace global `fetch` with a URL-routed mock. `route` returns a {@link Reply} for
 * a URL, or `undefined` to fail the test loudly on an unexpected call. Keeps the
 * provider suites fully offline (no Spotify/TMDB, no rate limits).
 */
export function mockFetch(route: (url: string) => Reply | undefined) {
  const fn = vi.fn(async (input: string | URL) => {
    const u = String(input);
    const r = route(u);
    if (!r) throw new Error(`Unmocked fetch: ${u}`);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      headers: { get: (k: string) => r.headers?.[k.toLowerCase()] ?? null },
      json: async () => r.json ?? {},
      text: async () => r.text ?? JSON.stringify(r.json ?? {}),
    } as unknown as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

export const jsonOk = (json: unknown): Reply => ({ json });
