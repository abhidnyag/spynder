# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repository.

## What this is

**Spynder** is a "can't-decide" app: one tap suggests a random **song**, **movie**,
**series**, or **book**, optionally narrowed by genre, vibe, or a free-text mood. It's a single
**Next.js 15** (App Router) application that bundles the React frontend and a GraphQL
backend in one Node process, backed by **MySQL** via **Prisma**.

See [README.md](./README.md) for setup and [ARCHITECTURE.md](./ARCHITECTURE.md) for a
deep, step-by-step walkthrough of the stack.

## Common commands

```bash
npm run dev          # Start Next.js in development (http://localhost:3000)
npm run build        # Production build
npm start            # Serve the production build
npm run typecheck    # tsc --noEmit — run this to verify changes compile
npm run lint         # next lint
npm test             # vitest run — offline unit tests (network mocked)
npm run test:watch   # vitest in watch mode

npm run db:push      # Sync prisma/schema.prisma to MySQL
npm run db:seed      # (Re)load the sample catalogue (safe to re-run)
npm run db:setup     # db:push + db:seed
npm run db:generate  # Regenerate the Prisma client

docker compose up -d        # MySQL on :3306 + Adminer on :8080
docker compose down [-v]    # stop (keep data) / -v also deletes data
```

Tests use **Vitest** (`npm test`), configured in `vitest.config.ts` (Node env, `@/`
alias). Provider tests live in `src/server/providers/__tests__/` and mock global
`fetch` via `fetchMock.ts`, so the suite is fully offline — it never calls Spotify/TMDB
and can't be rate-limited. Run `npm run typecheck` alongside as the compile gate.

## Architecture (layered)

A request flows top-down through clearly separated layers — each depends only on the
one beneath it. Keep this separation when adding features.

| Layer | Location | Responsibility |
| --- | --- | --- |
| Presentation | `src/components/screens`, `src/components/ui` | Render UI, capture input |
| Client data | `src/lib/apollo-client.ts`, `src/graphql/operations.ts` | Fetch/mutate via GraphQL |
| API contract | `src/graphql/schema.ts` | The GraphQL type definitions |
| Resolvers | `src/graphql/resolvers.ts` | Thin glue: validate args, call services |
| Services | `src/server/services/*` | **Business logic** (random pick, filtering, history) |
| Providers | `src/server/providers/*` | External catalogues (Spotify, TMDB, Open Library) behind the service |
| Data access | `src/lib/prisma.ts`, `prisma/schema.prisma` | Prisma ORM + MySQL |

The single backend entry point is the Apollo Server route handler at
[src/app/api/graphql/route.ts](src/app/api/graphql/route.ts).

## Conventions & gotchas

- **Keep resolvers thin.** Put real logic in `src/server/services/*`, not in
  resolvers or components. The Prisma client is passed via GraphQL context
  ([src/graphql/context.ts](src/graphql/context.ts)).
- **Theming is token-driven.** Colors come from CSS variables in
  [src/app/globals.scss](src/app/globals.scss), surfaced as Tailwind utilities via
  [tailwind.config.ts](tailwind.config.ts). The two-tone accent (blue for Music, clay
  for Movies/TV) is switched by a single `data-mode` attribute set from
  [src/context/ModeContext.tsx](src/context/ModeContext.tsx). Don't hardcode colors —
  use the tokens, and don't re-style inside screens; compose `components/ui` primitives.
- **`mode` is `MUSIC | MOVIE | BOOK`** throughout (the enum in the Prisma schema and
  GraphQL). The accent theme switches per mode via `data-mode` (music=blue, movie=clay,
  book=sage); add new modes to `TAXONOMY`/`MODE_META` in `src/lib/taxonomy.ts`.
- **JSON array columns.** `genres`, `vibes`, and `providers` are stored as JSON string
  arrays in MySQL and normalized to real arrays via `toSuggestionDTO()` before leaving
  the service layer.
- **Suggestions never dead-end.** If filters eliminate all candidates, the service falls
  back to the unfiltered pool. If an external provider key is missing or a call fails,
  it falls back to the seeded DB pick (`getRandomFromSeed`). Preserve this graceful
  degradation when touching the suggestion path.
- **External providers cache into MySQL.** A live spin upserts the result with a stable
  id (`spotify:<id>`, `tmdb:movie:<id>`) so the `HistoryEntry` foreign key stays valid.
- **Every spin records history.** `getRandomSuggestion` writes a `suggested` history row;
  Save/Skip write via the `recordHistory` mutation.
- **Accessibility is non-negotiable.** Whenever you add or change any HTML, JSX, or input
  field, follow current accessibility standards (WCAG 2.1 AA and the WAI-ARIA Authoring
  Practices). Use semantic elements, label every input (`<label>`/`aria-label`),
  associate errors via `aria-describedby`, keep controls keyboard-operable with a visible
  focus state, preserve sufficient color contrast, give icon-only buttons accessible
  names, and add ARIA roles/attributes only when no native element fits. Keep this
  knowledge up to date with evolving accessibility standards as the codebase changes.

## Environment

Copy `.env.example` to `.env`. `DATABASE_URL` defaults to the bundled docker-compose
MySQL. Optional `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` (music) and `TMDB_API_KEY`
(movies/TV) switch from seed data to live results; without them those modes use the
seeded catalogue. **Books are live by default** via Open Library, which is free and
keyless (no env var); it still falls back to seeded books if the API is unreachable.
