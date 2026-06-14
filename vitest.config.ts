import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Server-side unit tests run in Node with the same "@/" alias as the app.
// All network calls are mocked (see src/server/providers/__tests__/fetchMock.ts),
// so the suite never touches Spotify/TMDB and can't be rate-limited.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
