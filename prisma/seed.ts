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
];

const screen: Seed[] = [
  { mode: "MOVIE", type: "movie", title: "Everything Everywhere All at Once", year: 2022, rating: 8.0, runtime: "2h 19m", genres: ["Sci-Fi", "Comedy"], vibes: ["Mind-bending", "Feel-good"], providers: ["Netflix", "Prime"], synopsis: "A burnt-out laundromat owner is swept into a multiverse adventure and must connect with other versions of herself to save it all." },
  { mode: "MOVIE", type: "movie", title: "The Grand Budapest Hotel", year: 2014, rating: 8.1, runtime: "1h 39m", genres: ["Comedy", "Drama"], vibes: ["Feel-good", "Cozy"], providers: ["Disney+"], synopsis: "A legendary concierge and his protégé become entangled in the theft of a priceless painting and a battle over a vast fortune." },
  { mode: "MOVIE", type: "series", title: "The Bear", year: 2022, rating: 8.6, runtime: "Series", genres: ["Drama", "Comedy"], vibes: ["Edge-of-seat", "Feel-good"], providers: ["Disney+"], synopsis: "A fine-dining chef returns home to run his late brother's chaotic sandwich shop." },
  { mode: "MOVIE", type: "movie", title: "Parasite", year: 2019, rating: 8.5, runtime: "2h 12m", genres: ["Thriller", "Drama"], vibes: ["Edge-of-seat", "Mind-bending"], providers: ["Prime"], synopsis: "A poor family schemes to become employed by a wealthy household, with unexpected consequences." },
  { mode: "MOVIE", type: "series", title: "Severance", year: 2022, rating: 8.7, runtime: "Series", genres: ["Sci-Fi", "Thriller"], vibes: ["Mind-bending", "Edge-of-seat"], providers: ["Apple TV+"], synopsis: "Office workers surgically divide their memories between work and personal life — until the wall starts to crack." },
  { mode: "MOVIE", type: "movie", title: "Whiplash", year: 2014, rating: 8.5, runtime: "1h 46m", genres: ["Drama"], vibes: ["Edge-of-seat", "Tear-jerker"], providers: ["Netflix"], synopsis: "A young drummer is pushed to his limits by an abusive music conservatory instructor." },
  { mode: "MOVIE", type: "movie", title: "Spirited Away", year: 2001, rating: 8.6, runtime: "2h 5m", genres: ["Anime", "Drama"], vibes: ["Cozy", "Feel-good"], providers: ["Netflix"], synopsis: "A young girl wanders into a world of spirits and must find a way to free her parents and return home." },
  { mode: "MOVIE", type: "series", title: "Fleabag", year: 2016, rating: 8.7, runtime: "Series", genres: ["Comedy", "Drama"], vibes: ["Feel-good", "Tear-jerker"], providers: ["Prime"], synopsis: "A sharp, grief-stricken woman navigates love and family in London while breaking the fourth wall." },
  { mode: "MOVIE", type: "movie", title: "Get Out", year: 2017, rating: 7.7, runtime: "1h 44m", genres: ["Horror", "Thriller"], vibes: ["Edge-of-seat", "Mind-bending"], providers: ["Netflix"], synopsis: "A young man uncovers a disturbing secret when he meets his girlfriend's family for the first time." },
  { mode: "MOVIE", type: "movie", title: "Mad Max: Fury Road", year: 2015, rating: 8.1, runtime: "2h 0m", genres: ["Action", "Sci-Fi"], vibes: ["Edge-of-seat"], providers: ["Prime"], synopsis: "On a post-apocalyptic desert highway, two rebels flee a tyrant in a relentless, roaring chase." },
  { mode: "MOVIE", type: "movie", title: "La La Land", year: 2016, rating: 8.0, runtime: "2h 8m", genres: ["Romance", "Drama"], vibes: ["Feel-good", "Tear-jerker"], providers: ["Netflix"], synopsis: "A jazz pianist and an aspiring actress fall in love while chasing their dreams in Los Angeles." },
];

async function main() {
  // Idempotent: clear and re-seed so `db:seed` can be re-run safely.
  await prisma.historyEntry.deleteMany();
  await prisma.suggestion.deleteMany();
  await prisma.suggestion.createMany({ data: [...songs, ...screen] });
  console.log(`Seeded ${songs.length} songs and ${screen.length} movies/series.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
