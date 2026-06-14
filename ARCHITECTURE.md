# Spinder — Architecture & how it works

This document explains, step by step, how the app is structured and how a single
"Surprise Me" tap travels through the whole stack.

---

## 1. The big picture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser (React)                           │
│  Screens ── Apollo Client ──▶ POST /api/graphql                    │
└───────────────────────────────────�│──────────────────────────────┘
                                     │  (single Node process — Next.js)
┌───────────────────────────────────▼──────────────────────────────┐
│  Apollo Server (route handler)                                     │
│     resolvers ──▶ services (business logic) ──▶ Prisma ──▶ MySQL   │
└────────────────────────────────────────────────────────────────────┘
```

Everything runs inside one **Next.js** application on **Node.js**:

- The **frontend** is React Server/Client components under `src/app`.
- The **backend** is a single **GraphQL** endpoint at `src/app/api/graphql/route.ts`.
- **Prisma** talks to **MySQL**.

This keeps the deployment a single unit while preserving clean internal layering.

---

## 2. Layered design (enterprise-style separation)

Each layer has one responsibility and only depends on the layer beneath it:

| Layer | Location | Responsibility |
| --- | --- | --- |
| **Presentation** | `components/screens`, `components/ui` | Render UI, capture input |
| **Client data** | `lib/apollo-client.ts`, `graphql/operations.ts` | Fetch/mutate via GraphQL |
| **API contract** | `graphql/schema.ts` | The GraphQL types (the contract) |
| **Resolvers** | `graphql/resolvers.ts` | Thin glue: validate args, call services |
| **Services** | `server/services/*` | **Business logic** (random pick, filtering, history) |
| **Data access** | `lib/prisma.ts`, `prisma/schema.prisma` | ORM + database |

Why this matters: resolvers stay tiny, business rules live in plain, testable
functions, and the database can change without touching the UI.

---

## 3. The design system & theming

- **Tokens** live in `app/globals.scss` as CSS variables (`--bg`, `--surface`,
  `--ink`, `--accent`, …).
- **Tailwind** (`tailwind.config.ts`) maps those variables to utility classes
  (`bg-bg`, `text-sub`, `bg-accent`, …), so every component pulls from the same palette.
- **Two-tone accent:** `ModeContext` renders the app shell with a `data-mode`
  attribute. The SCSS rule `[data-mode="movie"] { --accent: … }` swaps the accent to
  muted clay for Movies; Music keeps muted blue. **One attribute recolors the
  entire UI** — buttons, chips, active states — guaranteeing consistency.
- **Primitives** in `components/ui` (`Button`, `Chip`, `SegmentedControl`,
  `SuggestBox`, `Icon`, `BottomNav`, `ScreenHeader`) are the only place visual style
  is defined; screens compose them, never re-style.

---

## 4. Data model (`prisma/schema.prisma`)

- **`Suggestion`** — one song / movie / series. `mode` is `MUSIC | MOVIE`;
  `genres`, `vibes`, and `providers` are JSON string arrays (MySQL has no native
  array type, so JSON keeps the schema small while staying queryable).
- **`HistoryEntry`** — an action (`suggested | saved | skipped`) on a suggestion,
  with a timestamp; cascades on delete.

`prisma/seed.ts` clears and reloads a sample catalogue (12 songs, 11 titles), so it
is safe to re-run.

---

## 5. The GraphQL API

**Schema** (`graphql/schema.ts`) exposes:

- `randomSuggestion(mode, filter)` → a random `Suggestion`
- `history(mode)` → recent spins
- `recordHistory(suggestionId, action)` and `clearHistory` mutations

**Resolvers** (`graphql/resolvers.ts`) receive a `context` carrying the Prisma client
(`graphql/context.ts`) and delegate straight to services.

**Services** hold the logic:

- `suggestion.service.ts → getRandomSuggestion()`
  1. Load candidates for the mode (optionally constrained by `type`).
  2. Filter in-process by `genres` / `vibes` (overlap) and by `query`
     (word match against title/artist/synopsis/tags).
  3. If filters eliminate everything, **fall back** to the unfiltered pool so the
     user is never dead-ended.
  4. Pick a random item, **record a `suggested` history row**, and return it.
- `history.service.ts` reads recent entries (newest first) and writes/clears them.

JSON columns are normalised to real string arrays by `toSuggestionDTO()` before
leaving the service, so the GraphQL layer sees clean `[String!]!` fields.

---

## 6. End-to-end: one "Surprise Me" tap

1. **Home** (`HomeScreen`) reads the active `mode` from `ModeContext` and routes to
   `/result?mode=MUSIC`.
2. **`/result` page** (server component) parses the URL into a typed `mode` + `filter`
   and passes them to `ResultScreen` (client).
3. **`ResultScreen`** runs the `RandomSuggestion` query via Apollo Client
   (`fetchPolicy: network-only`, so every spin is fresh).
4. The request hits **`/api/graphql`** → Apollo Server → `randomSuggestion` resolver
   → `getRandomSuggestion` service → Prisma → MySQL.
5. The service records the spin and returns the pick; Apollo delivers it to the
   component, which renders the **Music** or **Movie** layout.
6. **Spin again** calls `refetch()` (new random pick). **Save / Skip** fire the
   `recordHistory` mutation; **Skip** also refetches.
7. The **History** screen later queries `history` and lists those recorded spins.

The **Customize** flow is the same, except the chips and suggestion-box text are
encoded into the `/result` query string and become the `filter` argument.

---

## 7. Why it scales

- **Stateless API** — the GraphQL endpoint holds no session state, so it scales
  horizontally behind a load balancer.
- **Single connection pool** — `lib/prisma.ts` reuses one `PrismaClient` (guarded
  against hot-reload duplication in dev).
- **Clear seams** — swapping the in-process filter for an indexed SQL query, adding
  auth in `createContext`, or introducing a real recommendation service only touches
  the **service** layer; UI and schema are unaffected.
- **Typed contract** — the GraphQL schema + shared TypeScript types keep client and
  server in lockstep, catching drift at compile time.
- **Design tokens** — new screens inherit the theme automatically; there is no
  per-screen styling to keep in sync.

## 8. External catalogues (Spotify & TMDB)

Real data flows through a small **provider layer** (`server/providers/`) that sits behind
the existing service — the GraphQL schema and UI did not change shape, only gained
`url` and `imageUrl` fields.

- `providers/spotify.ts` — caches a **client-credentials** token, searches the Web API
  with the `genre:"…"` filter, and enriches the pick with the artist's genres. For the
  **30-sec audio preview**, the Web API now returns `preview_url: null` for newer apps,
  so it falls back to scraping the public embed page (`open.spotify.com/embed/track/…`)
  for the `p.scdn.co/mp3-preview/…` url.
- `providers/tmdb.ts` — uses `/discover` (or `/search` for free text), then one details
  call with `append_to_response=watch/providers,videos` for runtime, where-to-watch, and
  the **YouTube trailer** key. Genre chips are mapped to TMDB genre ids (with movie/tv
  aliases). Spotify dev-mode caps search `limit` at 10.

These feed two extra fields — `previewUrl` and `trailerUrl` — which the result screen
turns into a working **in-app audio player** (`<audio>`) and an **inline trailer**
(YouTube `<iframe>` overlay). Both degrade gracefully: no preview → the play button opens
Spotify; no trailer → the button opens the TMDB page.
- `providers/types.ts` — the shared `ExternalSuggestion` shape, a `ProviderUnavailable`
  error, and small helpers.

`getRandomSuggestion` now:

1. Calls the provider for the mode (Spotify for music, TMDB for movies/series).
2. **Upserts** the result into MySQL (stable id like `spotify:<id>` / `tmdb:movie:<id>`)
   so the `HistoryEntry` foreign key and the seed fallback remain valid, then records
   the spin.
3. On `ProviderUnavailable` (no key) **or any error**, falls back to
   `getRandomFromSeed` — the original DB pick. The app degrades gracefully and never
   dead-ends.

This means the database doubles as a **cache of real catalogue data**: every spin you
make with keys configured leaves a real, queryable row behind.

## 9. Authentication

Accounts are handled inside the same GraphQL API, with logic in `auth.service.ts`:

- **Passwords** are hashed with `bcryptjs`; never stored or returned in plaintext.
- **Sessions** are a signed **JWT** (`jsonwebtoken`, secret `AUTH_SECRET`) stored in an
  **httpOnly, SameSite=Lax cookie** (`spinder_token`) — not readable by JS, set/cleared
  via `next/headers` `cookies()` in `src/lib/auth.ts`.
- **Context** (`graphql/context.ts`) reads the cookie on every request, verifies the
  token, and loads `ctx.user` so resolvers know who's calling.
- **Operations:** `register`, `login`, `logout` mutations and a `me` query.
- **Password reset:** `requestPasswordReset` issues a short-lived (30 min) signed
  reset JWT; `resetPassword` verifies it and sets the new (re-validated) password.
  No email transport is configured, so the token is returned as `devToken` for local
  use — in production you'd email a reset link and not return it. The request always
  reports success so attackers can't probe which emails exist.
- **Authorization:** `recordHistory` / `clearHistory` require `ctx.user` (throw
  `UNAUTHENTICATED` otherwise); `history` is scoped to the user (anonymous → empty).
  `HistoryEntry.userId` ties every spin to its owner (`null` for anonymous sessions),
  so the recently-picked guard is also per-user.

On the client, `AuthContext` exposes `user` + `login/register/logout` (backed by the
`me` query). The **Profile** screen renders sign-in/register forms or the account view;
the **History** screen and the **Save/Watchlist** action are gated behind login.

### Natural next steps

- Real catalogues via external APIs (Spotify / TMDB) behind the same service interface.
- User accounts + per-user history (add auth to `createContext`, scope queries by user).
- Move genre/vibe filtering into SQL with proper indexes once the catalogue grows.
- Add unit tests on the service layer and integration tests on the resolvers.
