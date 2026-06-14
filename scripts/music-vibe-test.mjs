// Ad-hoc test: mirrors the new getRandomTrack mood-tag logic against the live
// Spotify API to confirm a typed vibe returns mood-relevant tracks.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const API = "https://api.spotify.com/v1";
const SEARCH_LIMIT = 10;
const rand = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rand(a.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Kept in sync with src/server/providers/spotify.ts
const VIBE_GENRE_TAGS = {
  chill: "chill", relax: "chill", relaxing: "chill", rainy: "chill", sunday: "chill", calm: "chill", cozy: "chill", cleaning: "chill", mellow: "chill",
  energetic: "workout", energy: "workout", hype: "workout", pump: "workout", upbeat: "workout", workout: "workout", gym: "workout", running: "workout", exercise: "workout",
  focus: "study", study: "study", studying: "study", productive: "study", concentrate: "study", reading: "study",
  party: "party", dance: "party", dancing: "party", club: "party", rave: "party",
  sad: "acoustic", melancholy: "acoustic", heartbreak: "acoustic", crying: "acoustic", lonely: "acoustic", emotional: "acoustic", moody: "acoustic",
  romantic: "jazz", romance: "jazz", dinner: "jazz", date: "jazz", smooth: "jazz",
  sleep: "sleep", sleepy: "sleep", bedtime: "sleep",
  lofi: "lo-fi", "lo-fi": "lo-fi", jazz: "jazz", acoustic: "acoustic", classical: "classical", piano: "piano",
};
const vibeGenreTag = (text) => { const t = text.toLowerCase(); return Object.entries(VIBE_GENRE_TAGS).find(([w]) => t.includes(w))?.[1] ?? null; };
const SIBLING_TAGS = {
  study: ["lo-fi", "ambient"], "lo-fi": ["chill", "study"], sleep: ["ambient", "new-age"],
  acoustic: ["folk", "singer-songwriter"], piano: ["classical", "ambient"], classical: ["piano", "ambient"],
  jazz: ["soul", "lounge"], chill: ["lo-fi", "lounge"], workout: ["edm", "dance"], party: ["dance", "edm"],
};
const dedupe = (rows) => [...new Map(rows.map((t) => [t.id, t])).values()];

async function jget(url, init) {
  let last;
  for (let i = 0; i < 8; i++) {
    try {
      const r = await fetch(url, init);
      const text = await r.text();
      if (r.status === 429) { // honor Spotify's Retry-After (seconds)
        const wait = (Number(r.headers.get("retry-after")) || 5) * 1000 + 500;
        console.error(`  (429 — waiting ${Math.round(wait / 1000)}s)`);
        await sleep(wait); continue;
      }
      return { ok: r.ok, status: r.status, body: text ? JSON.parse(text) : {} };
    } catch (e) { last = e; await sleep(500 * (i + 1)); }
  }
  throw last ?? new Error("rate limited");
}
async function getToken() {
  const { body } = await jget("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64") },
    body: "grant_type=client_credentials",
  });
  return body.access_token;
}
const auth = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

async function searchTracks(token, q, offset) {
  const { ok, body } = await jget(`${API}/search?type=track&market=US&limit=${SEARCH_LIMIT}&offset=${offset}&q=${encodeURIComponent(q)}`, auth(token));
  return ok ? body.tracks?.items ?? [] : [];
}
// Pull the chosen track's artist genres, to objectively check it fits the vibe.
async function artistGenres(token, track) {
  const id = track.artists[0]?.id;
  if (!id) return [];
  const { body } = await jget(`${API}/artists/${id}`, auth(token));
  return body.genres ?? [];
}

async function moodPool(token, tag) {
  let pool = dedupe([...(await searchTracks(token, `genre:"${tag}"`, rand(20))), ...(await searchTracks(token, `genre:"${tag}"`, 0))]);
  const widenedFrom = [];
  for (const sib of SIBLING_TAGS[tag] ?? []) {
    if (pool.length >= 15) break;
    pool = dedupe([...pool, ...(await searchTracks(token, `genre:"${sib}"`, 0))]);
    widenedFrom.push(sib);
  }
  return { pool, widenedFrom };
}

async function run(token, vibe) {
  const tag = vibeGenreTag(vibe);
  let items, widenedFrom = [];
  if (tag) ({ pool: items, widenedFrom } = await moodPool(token, tag));
  else { items = await searchTracks(token, vibe, rand(20)); if (!items.length) items = await searchTracks(token, vibe, 0); }
  const widen = widenedFrom.length ? `  (+siblings: ${widenedFrom.join(", ")})` : "";
  console.log(`\n=== "${vibe}"  → mood tag: ${tag ?? "(none, free-text)"}  [pool ${items.length}]${widen}`);
  // Sample 4 distinct picks to show what "Spin again" would surface.
  for (const t of dedupe(items).sort(() => Math.random() - 0.5).slice(0, 4)) {
    console.log(`    • ${t.name} — ${t.artists.map((a) => a.name).join(", ")}`);
  }
  await sleep(400); // be gentle on the rate limiter between vibes
}

const token = await getToken();
for (const v of ["Focus", "Sad", "Romantic", "rainy sunday morning cleaning"]) {
  await run(token, v);
}
