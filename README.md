# 🎲 Spinder

A *can't-decide* app. One tap suggests a **random song**, **movie**, or **series**.
Too random? Narrow it by **genre**, **vibe**, or just describe your mood in the
suggestion box.

Built as a small but production-shaped full-stack app.

| Layer | Tech |
| --- | --- |
| Framework | **Next.js 15** (App Router) + **React 18** + **TypeScript** |
| Styling | **Tailwind CSS** + **SCSS** design tokens |
| API | **GraphQL** via **Apollo Server 4** (Next.js route handler) + **Apollo Client** |
| Data | **MySQL** via **Prisma ORM** |
| Runtime | **Node.js** |

> Design language carried over from the **Variant B "two-tone"** mockups: a minimal
> dark theme where the accent switches between **muted blue (Music)** and
> **muted clay (Movies & TV)**.

---

## Project description

Spinder solves a tiny but universal problem: *"I want to listen to / watch something,
but I can't decide what."* Pick a mode — **Music** or **Movies & TV** — and tap
**Surprise Me** to get a single, instant recommendation. If a fully random pick is too
much of a gamble, open **Customize** to narrow it down with **genre** and **vibe** chips
or by typing your mood into the suggestion box. Every spin is saved to **History**, so
you can revisit past picks and see what you saved or skipped.

Under the hood it's a small but production-shaped, full-stack application:

- **One Next.js process** serves both the React frontend and a single **GraphQL** API
  (`/api/graphql`), keeping deployment as one unit while preserving clean internal layers.
- **Enterprise-style layering** — UI → Apollo Client → GraphQL schema → resolvers →
  services (business logic) → Prisma → MySQL — so business rules stay in plain, testable
  functions and the database can change without touching the UI.
- **Token-driven theming** — a single `data-mode` attribute recolors the entire UI
  between the two accent palettes, guaranteeing visual consistency across screens.
- **Real or sample data** — works out of the box on a seeded catalogue, and switches to
  live results from **Spotify** (music) and **TMDB** (movies/TV) when API keys are
  provided, caching every live pick back into MySQL. It falls back to seed data on any
  failure, so the app never dead-ends.

For a step-by-step walkthrough of the stack, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Prerequisites

- **Node.js 18.18+** (Node 20+ recommended)
- A MySQL 8 server — either the **bundled Docker container** (recommended, zero setup)
  or an existing MySQL instance you point `DATABASE_URL` at.

---

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (default already matches docker-compose.yml)
cp .env.example .env        # Windows: copy .env.example .env

# 3. Start MySQL with Docker (no local MySQL install needed)
docker compose up -d        # MySQL on :3306 + Adminer DB browser on :8080

# 4. Create the schema and load sample songs + movies
npm run db:setup            # = prisma db push && prisma db seed

# 5. Start the dev server
npm run dev
```

> **No Docker?** Use any MySQL 8 server instead: create a `spinder` database, set
> `DATABASE_URL` in `.env` to its connection string, then run steps 4–5. Skip step 3.

Stop / reset the database:

```bash
docker compose down         # stop MySQL (data is kept)
docker compose down -v      # stop and DELETE all data
```

Open **http://localhost:3000**.
The GraphQL endpoint (and Apollo sandbox in dev) lives at **http://localhost:3000/api/graphql**.

Browse the database at **http://localhost:8080** (Adminer):
System **MySQL** · Server **mysql** · Username **root** · Password **spinder** · Database **spinder**.

### Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start Next.js in development |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run db:push` | Sync the Prisma schema to MySQL |
| `npm run db:seed` | (Re)load the sample catalogue — safe to re-run |
| `npm run db:setup` | `db:push` + `db:seed` in one step |

---

## Real data (Spotify & TMDB) — optional

Out of the box the app serves the **seeded sample catalogue**. Add API credentials to
`.env` to switch to live results — **Music → Spotify**, **Movies/TV → TMDB**:

```bash
SPOTIFY_CLIENT_ID="..."       # https://developer.spotify.com/dashboard (Client Credentials)
SPOTIFY_CLIENT_SECRET="..."
TMDB_API_KEY="..."            # https://www.themoviedb.org/settings/api (v3 key)
```

Restart `npm run dev` after editing `.env`. Behaviour:

- Each spin fetches a fresh pick from the relevant API, then **caches it into MySQL**
  (so history and the tables stay populated with real titles + cover art / posters).
- If a key is **missing** or an API call **fails**, that spin **falls back** to the
  seeded data automatically — the app never breaks.
- You can enable just one provider (e.g. only TMDB); the other keeps using seed data.

---

## How to use the app

1. **Home** — toggle **Music / Movies & TV**, then tap **Surprise Me** for an instant pick.
2. **Result** — play/preview, **Save**, **Skip**, or **Spin again** for another random pick.
3. **Customize** — tap *“Pick a genre or vibe”*, choose chips and/or type a mood in the
   **suggestion box**, then **Surprise me** for a filtered pick. A typed description is
   **remembered per mode** and carries into the Home *Surprise Me* and *Spin again* /
   *Skip* — Home shows it as a "Using your note" chip you can clear.
4. **Profile** — **register / log in** to save picks. Auth uses a bcrypt-hashed password
   and a JWT in an httpOnly cookie; set `AUTH_SECRET` in `.env`.
5. **History** — your saved/spun picks (per account); filter by All / Music / Watch, or
   **Clear**. Saving and History require being signed in.

---

## Project layout

```
src/
├─ app/                    # Next.js App Router (pages, layout, /api/graphql)
│  ├─ api/graphql/route.ts # Apollo Server endpoint
│  ├─ (pages)/             # /, /customize, /result, /history, /profile
│  ├─ providers.tsx        # Apollo + Mode context
│  └─ globals.scss         # design tokens + Tailwind layers
├─ components/
│  ├─ ui/                  # reusable design-system primitives
│  └─ screens/             # one component per screen
├─ context/ModeContext.tsx # active mode → swaps the --accent token
├─ graphql/                # schema, resolvers, context, client operations
├─ server/services/        # business logic (suggestion + history)
├─ lib/                    # prisma client, apollo client, taxonomy
└─ types/                  # shared TypeScript types
prisma/
├─ schema.prisma           # MySQL data model
└─ seed.ts                 # sample songs + movies/series
```

A deeper, step-by-step walkthrough of how a request flows through the stack is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Troubleshooting

- **`Can't reach database server`** — check MySQL is running and `DATABASE_URL` is correct.
- **`Table doesn't exist`** — run `npm run db:push` (or `npm run db:setup`).
- **No suggestions appear** — run `npm run db:seed` to load the catalogue.
