import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Seed = Omit<Prisma.SuggestionCreateManyInput, "id">;

const songs: Seed[] = [
  { mode: "MUSIC", title: "Midnight City", artist: "M83", year: 2011, genres: ["Indie", "Electronic"], vibes: ["Energetic", "Chill"] },
  { mode: "MUSIC", title: "Redbone", artist: "Childish Gambino", year: 2016, genres: ["Hip-Hop", "Pop"], vibes: ["Chill", "Romantic"] },
  { mode: "MUSIC", title: "Weightless", artist: "Marconi Union", year: 2012, genres: ["Electronic", "Classical"], vibes: ["Focus", "Chill"] },
  { mode: "MUSIC", title: "Nightcall", artist: "Kavinsky", year: 2010, genres: ["Electronic", "Pop"], vibes: ["Energetic", "Chill"] },
  { mode: "MUSIC", title: "Sunflower", artist: "Post Malone", year: 2018, genres: ["Hip-Hop", "Pop"], vibes: ["Party", "Chill"] },
  { mode: "MUSIC", title: "Tek It", artist: "Cafuné", year: 2021, genres: ["Indie", "Pop"], vibes: ["Energetic", "Party"] },
  { mode: "MUSIC", title: "Holocene", artist: "Bon Iver", year: 2011, genres: ["Indie", "Rock"], vibes: ["Sad", "Chill"] },
  { mode: "MUSIC", title: "Get Lucky", artist: "Daft Punk", year: 2013, genres: ["Electronic", "Pop"], vibes: ["Party", "Energetic"] },
  { mode: "MUSIC", title: "So What", artist: "Miles Davis", year: 1959, genres: ["Jazz"], vibes: ["Focus", "Chill"] },
  { mode: "MUSIC", title: "Lofi Sunrise", artist: "Idealism", year: 2017, genres: ["Lo-fi"], vibes: ["Focus", "Chill"] },
  { mode: "MUSIC", title: "Bohemian Rhapsody", artist: "Queen", year: 1975, genres: ["Rock"], vibes: ["Energetic"] },
  { mode: "MUSIC", title: "Clair de Lune", artist: "Claude Debussy", year: 1905, genres: ["Classical"], vibes: ["Sad", "Romantic"] },
  { mode: "MUSIC", title: "Blinding Lights", artist: "The Weeknd", year: 2019, genres: ["Pop", "Electronic"], vibes: ["Energetic", "Party"] },
  { mode: "MUSIC", title: "good 4 u", artist: "Olivia Rodrigo", year: 2021, genres: ["Pop", "Rock"], vibes: ["Energetic", "Party"] },
  { mode: "MUSIC", title: "As It Was", artist: "Harry Styles", year: 2022, genres: ["Pop"], vibes: ["Chill", "Sad"] },
  { mode: "MUSIC", title: "HUMBLE.", artist: "Kendrick Lamar", year: 2017, genres: ["Hip-Hop"], vibes: ["Energetic", "Party"] },
  { mode: "MUSIC", title: "Nuvole Bianche", artist: "Ludovico Einaudi", year: 2004, genres: ["Classical"], vibes: ["Sad", "Focus"] },
  { mode: "MUSIC", title: "Take Five", artist: "The Dave Brubeck Quartet", year: 1959, genres: ["Jazz"], vibes: ["Focus", "Chill"] },
  { mode: "MUSIC", title: "Levitating", artist: "Dua Lipa", year: 2020, genres: ["Pop", "Electronic"], vibes: ["Party", "Energetic"] },
  { mode: "MUSIC", title: "The Less I Know the Better", artist: "Tame Impala", year: 2015, genres: ["Indie", "Rock"], vibes: ["Chill", "Energetic"] },
  { mode: "MUSIC", title: "lovely", artist: "Billie Eilish, Khalid", year: 2018, genres: ["Pop"], vibes: ["Sad", "Romantic"] },
  { mode: "MUSIC", title: "Strobe", artist: "deadmau5", year: 2009, genres: ["Electronic"], vibes: ["Focus", "Energetic"] },
  { mode: "MUSIC", title: "Heat Waves", artist: "Glass Animals", year: 2020, genres: ["Indie", "Pop"], vibes: ["Chill", "Sad"] },
  { mode: "MUSIC", title: "Fast Car", artist: "Tracy Chapman", year: 1988, genres: ["Rock", "Indie"], vibes: ["Sad", "Chill"] },
  { mode: "MUSIC", title: "Snowman", artist: "WYS", year: 2019, genres: ["Lo-fi"], vibes: ["Chill", "Focus"] },
  { mode: "MUSIC", title: "Juicy", artist: "The Notorious B.I.G.", year: 1994, genres: ["Hip-Hop"], vibes: ["Party", "Energetic"] },
];

const screen: Seed[] = [
  { mode: "MOVIE", type: "movie", title: "Everything Everywhere All at Once", year: 2022, rating: 8.0, runtime: "2h 19m", genres: ["Sci-Fi", "Comedy"], vibes: ["Mind-bending", "Feel-good"], providers: ["Netflix", "Prime"], director: "Daniel Kwan, Daniel Scheinert", cast: ["Michelle Yeoh", "Stephanie Hsu", "Ke Huy Quan", "Jamie Lee Curtis"], synopsis: "A burnt-out laundromat owner is swept into a multiverse adventure and must connect with other versions of herself to save it all." },
  { mode: "MOVIE", type: "movie", title: "The Grand Budapest Hotel", year: 2014, rating: 8.1, runtime: "1h 39m", genres: ["Comedy", "Drama"], vibes: ["Feel-good", "Cozy"], providers: ["Disney+"], director: "Wes Anderson", cast: ["Ralph Fiennes", "Tony Revolori", "Adrien Brody", "Saoirse Ronan"], synopsis: "A legendary concierge and his protégé become entangled in the theft of a priceless painting and a battle over a vast fortune." },
  { mode: "MOVIE", type: "series", title: "The Bear", year: 2022, rating: 8.6, runtime: "Series", genres: ["Drama", "Comedy"], vibes: ["Edge-of-seat", "Feel-good"], providers: ["Disney+"], director: "Christopher Storer", cast: ["Jeremy Allen White", "Ebon Moss-Bachrach", "Ayo Edebiri", "Lionel Boyce"], synopsis: "A fine-dining chef returns home to run his late brother's chaotic sandwich shop." },
  { mode: "MOVIE", type: "movie", title: "Parasite", year: 2019, rating: 8.5, runtime: "2h 12m", genres: ["Thriller", "Drama"], vibes: ["Edge-of-seat", "Mind-bending"], providers: ["Prime"], director: "Bong Joon-ho", cast: ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong", "Choi Woo-shik"], synopsis: "A poor family schemes to become employed by a wealthy household, with unexpected consequences." },
  { mode: "MOVIE", type: "series", title: "Severance", year: 2022, rating: 8.7, runtime: "Series", genres: ["Sci-Fi", "Thriller"], vibes: ["Mind-bending", "Edge-of-seat"], providers: ["Apple TV+"], director: "Dan Erickson", cast: ["Adam Scott", "Britt Lower", "Patricia Arquette", "John Turturro"], synopsis: "Office workers surgically divide their memories between work and personal life — until the wall starts to crack." },
  { mode: "MOVIE", type: "movie", title: "Whiplash", year: 2014, rating: 8.5, runtime: "1h 46m", genres: ["Drama"], vibes: ["Edge-of-seat", "Tear-jerker"], providers: ["Netflix"], director: "Damien Chazelle", cast: ["Miles Teller", "J.K. Simmons", "Melissa Benoist", "Paul Reiser"], synopsis: "A young drummer is pushed to his limits by an abusive music conservatory instructor." },
  { mode: "MOVIE", type: "movie", title: "Spirited Away", year: 2001, rating: 8.6, runtime: "2h 5m", genres: ["Anime", "Drama"], vibes: ["Cozy", "Feel-good"], providers: ["Netflix"], director: "Hayao Miyazaki", cast: ["Rumi Hiiragi", "Miyu Irino", "Mari Natsuki", "Takashi Nato"], synopsis: "A young girl wanders into a world of spirits and must find a way to free her parents and return home." },
  { mode: "MOVIE", type: "series", title: "Fleabag", year: 2016, rating: 8.7, runtime: "Series", genres: ["Comedy", "Drama"], vibes: ["Feel-good", "Tear-jerker"], providers: ["Prime"], director: "Phoebe Waller-Bridge", cast: ["Phoebe Waller-Bridge", "Sian Clifford", "Olivia Colman", "Andrew Scott"], synopsis: "A sharp, grief-stricken woman navigates love and family in London while breaking the fourth wall." },
  { mode: "MOVIE", type: "movie", title: "Get Out", year: 2017, rating: 7.7, runtime: "1h 44m", genres: ["Horror", "Thriller"], vibes: ["Edge-of-seat", "Mind-bending"], providers: ["Netflix"], director: "Jordan Peele", cast: ["Daniel Kaluuya", "Allison Williams", "Bradley Whitford", "Catherine Keener"], synopsis: "A young man uncovers a disturbing secret when he meets his girlfriend's family for the first time." },
  { mode: "MOVIE", type: "movie", title: "Mad Max: Fury Road", year: 2015, rating: 8.1, runtime: "2h 0m", genres: ["Action", "Sci-Fi"], vibes: ["Edge-of-seat"], providers: ["Prime"], director: "George Miller", cast: ["Tom Hardy", "Charlize Theron", "Nicholas Hoult", "Hugh Keays-Byrne"], synopsis: "On a post-apocalyptic desert highway, two rebels flee a tyrant in a relentless, roaring chase." },
  { mode: "MOVIE", type: "movie", title: "La La Land", year: 2016, rating: 8.0, runtime: "2h 8m", genres: ["Romance", "Drama"], vibes: ["Feel-good", "Tear-jerker"], providers: ["Netflix"], director: "Damien Chazelle", cast: ["Ryan Gosling", "Emma Stone", "John Legend", "Rosemarie DeWitt"], synopsis: "A jazz pianist and an aspiring actress fall in love while chasing their dreams in Los Angeles." },
];

const books: Seed[] = [
  { mode: "BOOK", title: "The Midnight Library", artist: "Matt Haig", year: 2020, rating: 4.0, runtime: "304 pages", genres: ["Fiction", "Fantasy"], vibes: ["Thought-provoking", "Heartwarming"], synopsis: "Between life and death is a library where each book lets you try a different version of the life you could have lived." },
  { mode: "BOOK", title: "Project Hail Mary", artist: "Andy Weir", year: 2021, rating: 4.5, runtime: "496 pages", genres: ["Sci-Fi"], vibes: ["Page-turner", "Thought-provoking"], synopsis: "A lone astronaut wakes with no memory aboard a ship that is humanity's last hope — and must piece together how to save Earth." },
  { mode: "BOOK", title: "The Thursday Murder Club", artist: "Richard Osman", year: 2020, rating: 4.0, runtime: "368 pages", genres: ["Mystery"], vibes: ["Cozy", "Page-turner"], synopsis: "Four retirees in a peaceful village meet weekly to investigate cold cases — until a real murder lands on their doorstep." },
  { mode: "BOOK", title: "Klara and the Sun", artist: "Kazuo Ishiguro", year: 2021, rating: 3.8, runtime: "320 pages", genres: ["Sci-Fi", "Fiction"], vibes: ["Thought-provoking", "Dark"], synopsis: "An artificial friend observes the world with hope and wonder, watching for a chance to be chosen by a child to love." },
  { mode: "BOOK", title: "The Song of Achilles", artist: "Madeline Miller", year: 2011, rating: 4.3, runtime: "416 pages", genres: ["Fantasy", "Romance"], vibes: ["Heartwarming", "Dark"], synopsis: "A retelling of the Iliad through the tender, doomed love between Patroclus and the golden warrior Achilles." },
  { mode: "BOOK", title: "Educated", artist: "Tara Westover", year: 2018, rating: 4.5, runtime: "352 pages", genres: ["Non-fiction", "Biography"], vibes: ["Thought-provoking", "Dark"], synopsis: "A memoir of a girl raised off-grid by survivalist parents who leaves the mountain to earn a PhD from Cambridge." },
  { mode: "BOOK", title: "The Name of the Wind", artist: "Patrick Rothfuss", year: 2007, rating: 4.5, runtime: "662 pages", genres: ["Fantasy"], vibes: ["Page-turner", "Cozy"], synopsis: "A gifted young man grows into the most notorious wizard of his world, recounting the truth behind the legend." },
  { mode: "BOOK", title: "Gone Girl", artist: "Gillian Flynn", year: 2012, rating: 4.1, runtime: "432 pages", genres: ["Thriller", "Mystery"], vibes: ["Page-turner", "Dark"], synopsis: "When a woman vanishes on her wedding anniversary, her husband becomes the prime suspect in an unravelling marriage." },
  { mode: "BOOK", title: "A Man Called Ove", artist: "Fredrik Backman", year: 2012, rating: 4.4, runtime: "352 pages", genres: ["Fiction"], vibes: ["Heartwarming", "Cozy"], synopsis: "A curmudgeonly widower's solitary routine is upended by a boisterous family that moves in next door." },
  { mode: "BOOK", title: "Dune", artist: "Frank Herbert", year: 1965, rating: 4.2, runtime: "688 pages", genres: ["Sci-Fi"], vibes: ["Page-turner", "Thought-provoking"], synopsis: "On a desert planet prized for a reality-bending spice, a young heir is swept into a war for control of the universe." },
  { mode: "BOOK", title: "The Hobbit", artist: "J.R.R. Tolkien", year: 1937, rating: 4.3, runtime: "310 pages", genres: ["Fantasy"], vibes: ["Cozy", "Page-turner"], synopsis: "A comfort-loving hobbit is swept into a quest to reclaim a mountain of treasure guarded by a dragon." },
  { mode: "BOOK", title: "And Then There Were None", artist: "Agatha Christie", year: 1939, rating: 4.3, runtime: "272 pages", genres: ["Mystery", "Thriller"], vibes: ["Page-turner", "Dark"], synopsis: "Ten strangers are lured to an island and picked off one by one, each death matching a sinister nursery rhyme." },
  { mode: "BOOK", title: "1984", artist: "George Orwell", year: 1949, rating: 4.2, runtime: "328 pages", genres: ["Sci-Fi", "Fiction"], vibes: ["Thought-provoking", "Dark"], synopsis: "In a society of total surveillance, a quiet clerk begins a forbidden act of rebellion: thinking for himself." },
  { mode: "BOOK", title: "Pride and Prejudice", artist: "Jane Austen", year: 1813, rating: 4.3, runtime: "432 pages", genres: ["Romance", "Fiction"], vibes: ["Heartwarming", "Cozy"], synopsis: "Sharp-witted Elizabeth Bennet and the proud Mr. Darcy spar their way from misjudgement toward love." },
  { mode: "BOOK", title: "The Silent Patient", artist: "Alex Michaelides", year: 2019, rating: 4.1, runtime: "336 pages", genres: ["Thriller", "Mystery"], vibes: ["Page-turner", "Dark"], synopsis: "A celebrated painter shoots her husband then never speaks again — and a psychotherapist becomes obsessed with making her talk." },
  { mode: "BOOK", title: "Sapiens", artist: "Yuval Noah Harari", year: 2011, rating: 4.4, runtime: "464 pages", genres: ["Non-fiction"], vibes: ["Thought-provoking"], synopsis: "A sweeping account of how one unremarkable ape came to dominate the planet, from cognition to capitalism." },
  { mode: "BOOK", title: "The Hitchhiker's Guide to the Galaxy", artist: "Douglas Adams", year: 1979, rating: 4.2, runtime: "224 pages", genres: ["Sci-Fi"], vibes: ["Page-turner", "Heartwarming"], synopsis: "Moments before Earth is demolished, an ordinary man is whisked into a gloriously absurd tour of the galaxy." },
  { mode: "BOOK", title: "Where the Crawdads Sing", artist: "Delia Owens", year: 2018, rating: 4.4, runtime: "384 pages", genres: ["Fiction", "Mystery"], vibes: ["Heartwarming", "Thought-provoking"], synopsis: "A girl raised alone in the marshes becomes the prime suspect when a local man is found dead." },
  { mode: "BOOK", title: "Mexican Gothic", artist: "Silvia Moreno-Garcia", year: 2020, rating: 3.7, runtime: "320 pages", genres: ["Fantasy", "Thriller"], vibes: ["Dark", "Page-turner"], synopsis: "A glamorous socialite visits a decaying mansion in the Mexican hills and uncovers its horrifying secret." },
  { mode: "BOOK", title: "Circe", artist: "Madeline Miller", year: 2018, rating: 4.3, runtime: "400 pages", genres: ["Fantasy"], vibes: ["Thought-provoking", "Heartwarming"], synopsis: "A scorned goddess discovers her power as a witch and carves out a life among gods, monsters, and mortals." },
  { mode: "BOOK", title: "The Seven Husbands of Evelyn Hugo", artist: "Taylor Jenkins Reid", year: 2017, rating: 4.4, runtime: "400 pages", genres: ["Fiction", "Romance"], vibes: ["Page-turner", "Heartwarming"], synopsis: "An aging Hollywood legend finally confesses the truth behind her seven marriages — and her one great love." },
  { mode: "BOOK", title: "Becoming", artist: "Michelle Obama", year: 2018, rating: 4.5, runtime: "448 pages", genres: ["Biography", "Non-fiction"], vibes: ["Heartwarming", "Thought-provoking"], synopsis: "The former First Lady's candid memoir, from the South Side of Chicago to the White House." },
];

// --- Cover art + links --------------------------------------------------------
// Fetched at seed time from keyless sources (iTunes for music, Open Library for
// books) so the seed catalogue shows real artwork and links, not placeholders.
// Failures degrade gracefully — the row just keeps a null image/url.
async function getJson(url: string): Promise<{ results?: any[]; docs?: any[] } | null> {
  // One retry — TMDB occasionally throws transient connection resets.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "spinder-seed" } });
      if (res.ok) return await res.json();
    } catch {
      /* transient — fall through to retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

// Spotify client-credentials token, fetched once (null if no keys / unavailable).
let spotifyToken: string | null | undefined;
async function getSpotifyToken(): Promise<string | null> {
  if (spotifyToken !== undefined) return spotifyToken;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return (spotifyToken = null);
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64") },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(6000),
    });
    const data = res.ok ? await res.json() : null;
    return (spotifyToken = data?.access_token ?? null);
  } catch {
    return (spotifyToken = null);
  }
}

async function enrichSong(s: Seed): Promise<Seed> {
  // Spotify only — match the live music provider (Spotify art + track link).
  const token = await getSpotifyToken();
  if (token) {
    try {
      const res = await fetch(`https://api.spotify.com/v1/search?type=track&market=US&limit=1&q=${encodeURIComponent(`${s.title} ${s.artist}`)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(6000),
      });
      const t = res.ok ? (await res.json())?.tracks?.items?.[0] : null;
      if (t?.external_urls?.spotify) {
        return { ...s, imageUrl: t.album?.images?.[0]?.url ?? null, url: t.external_urls.spotify };
      }
    } catch {
      /* fall through */
    }
  }
  // Spotify API unavailable (e.g. rate-limited): keep a Spotify search link, no Apple art.
  return { ...s, url: `https://open.spotify.com/search/${encodeURIComponent(`${s.title} ${s.artist}`)}`, imageUrl: null };
}

async function enrichBook(b: Seed): Promise<Seed> {
  const data = await getJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(`${b.title} ${b.artist}`)}&fields=cover_i,key&limit=1`);
  const d = data?.docs?.[0];
  if (!d) return b;
  return {
    ...b,
    imageUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    url: d.key ? `https://openlibrary.org${d.key}` : null,
  };
}

async function enrichMovie(m: Seed): Promise<Seed> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return m; // posters need the TMDB key; without it the row keeps its placeholder
  const kind = m.type === "series" ? "tv" : "movie";
  const yearParam = m.year ? (kind === "tv" ? `&first_air_date_year=${m.year}` : `&year=${m.year}`) : "";
  const data = await getJson(`https://api.themoviedb.org/3/search/${kind}?api_key=${key}&query=${encodeURIComponent(m.title)}${yearParam}`);
  const r = data?.results?.[0];
  if (!r) return m;
  return {
    ...m,
    imageUrl: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
    url: `https://www.themoviedb.org/${kind}/${r.id}`,
  };
}

async function main() {
  // Idempotent: clear and re-seed so `db:seed` can be re-run safely.
  await prisma.historyEntry.deleteMany();
  await prisma.suggestion.deleteMany();

  process.stdout.write("Fetching cover art & links… ");
  const enrichedSongs = await Promise.all(songs.map(enrichSong)); // iTunes handles concurrency well
  const enrichedScreen: Seed[] = [];
  for (const m of screen) enrichedScreen.push(await enrichMovie(m)); // sequential — avoids TMDB resets
  const enrichedBooks: Seed[] = [];
  for (const b of books) enrichedBooks.push(await enrichBook(b)); // sequential — gentler on Open Library
  process.stdout.write("done\n");

  const all = [...enrichedSongs, ...enrichedScreen, ...enrichedBooks];
  await prisma.suggestion.createMany({ data: all });
  console.log(
    `Seeded ${songs.length} songs, ${screen.length} movies/series and ${books.length} books (${all.filter((x) => x.imageUrl).length}/${all.length} with cover art).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
