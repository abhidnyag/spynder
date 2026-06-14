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
];

async function main() {
  // Idempotent: clear and re-seed so `db:seed` can be re-run safely.
  await prisma.historyEntry.deleteMany();
  await prisma.suggestion.deleteMany();
  await prisma.suggestion.createMany({ data: [...songs, ...screen, ...books] });
  console.log(`Seeded ${songs.length} songs, ${screen.length} movies/series and ${books.length} books.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
