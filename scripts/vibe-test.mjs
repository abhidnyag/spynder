// Ad-hoc test: mirrors the new getRandomTitle keyword+genre /discover logic
// against the live TMDB API to confirm vibe descriptions return relevant titles.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);
const KEY = env.TMDB_API_KEY;
const API = "https://api.themoviedb.org/3";

const VIBE_GENRE_HINTS = {
  funny: "Comedy", hilarious: "Comedy", comedy: "Comedy", lighthearted: "Comedy", "feel-good": "Comedy", cozy: "Comedy",
  scary: "Horror", horror: "Horror", creepy: "Horror", spooky: "Horror",
  romantic: "Romance", romance: "Romance", love: "Romance",
  sad: "Drama", emotional: "Drama", tear: "Drama", "tear-jerker": "Drama", moving: "Drama",
  action: "Action", explosive: "Action", adventure: "Action",
  thriller: "Thriller", suspense: "Thriller", tense: "Thriller", gritty: "Thriller", "edge-of-seat": "Thriller",
  scifi: "Sci-Fi", "sci-fi": "Sci-Fi", space: "Sci-Fi", futuristic: "Sci-Fi", "mind-bending": "Sci-Fi",
  anime: "Anime",
};
const GENRE_ALIASES = { "Sci-Fi": ["Science Fiction"], Anime: ["Animation"] };
const STOPWORDS = new Set(["the","and","for","with","that","this","into","want","something","anything","movie","movies","series","show","shows","watch","watching","like","really","very","some","just","about","under","over","than","then","from","they","what","when","where","kind","sort","stuff","please","give"]);

const url = (path, params = {}) =>
  `${API}${path}?` + new URLSearchParams({ api_key: KEY, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path, params) {
  let last;
  for (let i = 0; i < 5; i++) {
    try { return await (await fetch(url(path, params))).json(); }
    catch (e) { last = e; await sleep(300 * (i + 1)); }
  }
  throw last;
}

async function genreMap() {
  const d = await get("/genre/movie/list");
  return new Map(d.genres.map((g) => [g.name.toLowerCase(), g.id]));
}
async function genreIds(map, names) {
  const wanted = new Set(names.flatMap((n) => [n, ...(GENRE_ALIASES[n] ?? [])]).map((s) => s.toLowerCase()));
  return [...wanted].map((w) => map.get(w)).filter(Boolean);
}
function vibeGenreHints(text) {
  const t = text.toLowerCase();
  return [...new Set(Object.entries(VIBE_GENRE_HINTS).filter(([w]) => t.includes(w)).map(([, g]) => g))];
}
async function keywordIds(text) {
  const phrases = [text.trim(), ...text.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2 && !STOPWORDS.has(w))];
  const ids = new Set();
  const names = [];
  for (const phrase of phrases) {
    if (ids.size >= 4) break;
    const d = await get("/search/keyword", { query: phrase, page: 1 });
    if (d.results?.[0]) { ids.add(d.results[0].id); names.push(d.results[0].name); }
  }
  return { ids: [...ids], names };
}

const idToName = (map) => Object.fromEntries([...map].map(([n, id]) => [id, n]));
const dedupeById = (rows) => [...new Map(rows.map((r) => [r.id, r])).values()];

// Signals that a title really belongs to the cyberpunk subgenre.
const CYBERPUNK_SIGNALS = [
  "cyberpunk", "dystopia", "dystopian", "artificial intelligence", "cyborg", "android",
  "hacker", "hacking", "virtual reality", "cybernetic", "transhumanism", "neo-noir",
  "robot", "post-apocalyptic", "near future", "high tech", "biopunk", "matrix",
];

async function discover(vibe) {
  const map = await genreMap();
  const names = idToName(map);
  const { ids: keywords, names: kwNames } = await keywordIds(vibe);
  const genres = await genreIds(map, vibeGenreHints(vibe));
  const base = { sort_by: "popularity.desc", "vote_count.gte": 40, include_adult: "false" };
  let results = [];
  if (keywords.length) {
    const withKeywords = { ...base, with_keywords: keywords.join("|") };
    results = (await get("/discover/movie", genres.length ? { ...withKeywords, with_genres: genres.join(",") } : withKeywords)).results ?? [];
    if (results.length < 8 && genres.length) {
      const wide = (await get("/discover/movie", withKeywords)).results ?? [];
      if (wide.length > results.length) results = wide;
    }
  }
  if (results.length < 3 && genres.length) {
    const onGenre = (await get("/discover/movie", { ...base, with_genres: genres.join(",") })).results ?? [];
    results = dedupeById([...results, ...onGenre]);
  }
  return { results, kwNames, genreNames: genres.map((g) => names[g]) };
}

function printResults(vibe, { results, kwNames, genreNames }) {
  console.log(`\n=== "${vibe}"`);
  console.log(`    keywords: [${kwNames.join(", ") || "—"}]  genres: [${genreNames.join(", ") || "—"}]`);
  results.slice(0, 6).forEach((m) =>
    console.log(`    • ${m.title} (${(m.release_date || "—").slice(0, 4)})  ★${m.vote_average?.toFixed(1)}`),
  );
}

// Pull each title's own keywords and decide whether it's genuinely cyberpunk.
async function validateCyberpunk(results) {
  console.log(`\n--- Validating "cyberpunk" results against per-title keywords ---`);
  let pass = 0;
  for (const m of results.slice(0, 8)) {
    const kw = (await get(`/movie/${m.id}/keywords`)).keywords ?? [];
    const hay = kw.map((k) => k.name.toLowerCase());
    const hits = CYBERPUNK_SIGNALS.filter((s) => hay.some((h) => h.includes(s)));
    const ok = hits.includes("cyberpunk") || hits.length >= 2;
    if (ok) pass++;
    console.log(`    ${ok ? "✅" : "❌"} ${m.title} — signals: [${hits.join(", ") || "none"}]`);
  }
  const n = Math.min(results.length, 8);
  console.log(`    → ${pass}/${n} verified cyberpunk`);
}

for (const v of ["feel-good comedy", "tense and gritty thriller", "mind-bending sci-fi", "tear-jerker romance", "cozy mystery to relax to"]) {
  printResults(v, await discover(v));
}

const cyber = await discover("cyberpunk");
printResults("cyberpunk", cyber);
await validateCyberpunk(cyber.results);
