// Single source of truth for the genre/vibe options shown in the UI and used
// when seeding. Keeping it here avoids an extra round-trip just to list chips.

export type Mode = "MUSIC" | "MOVIE" | "BOOK";

export const TAXONOMY = {
  MUSIC: {
    genres: ["Pop", "Indie", "Hip-Hop", "Rock", "Lo-fi", "Jazz", "Electronic", "Classical"],
    vibes: ["Chill", "Energetic", "Sad", "Focus", "Party", "Romantic"],
  },
  MOVIE: {
    types: ["movie", "series"] as const,
    genres: ["Action", "Comedy", "Thriller", "Drama", "Sci-Fi", "Horror", "Romance", "Anime"],
    vibes: ["Feel-good", "Edge-of-seat", "Cozy", "Mind-bending", "Tear-jerker"],
  },
  BOOK: {
    genres: ["Fiction", "Mystery", "Sci-Fi", "Fantasy", "Romance", "Thriller", "Non-fiction", "Biography"],
    vibes: ["Cozy", "Page-turner", "Thought-provoking", "Heartwarming", "Dark"],
  },
} as const;

export const MODE_META: Record<Mode, { label: string; greeting: string }> = {
  MUSIC: { label: "Music", greeting: "What to listen to?" },
  MOVIE: { label: "Movies & TV", greeting: "What to watch?" },
  BOOK: { label: "Books", greeting: "What to read?" },
};
