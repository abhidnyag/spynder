import type { Mode } from "@/lib/taxonomy";

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt?: string;
}

export interface WatchLink {
  name: string;
  url: string;
}

export interface Suggestion {
  id: string;
  mode: Mode;
  source: string;
  type: string | null;
  title: string;
  artist: string | null;
  year: number | null;
  rating: number | null;
  runtime: string | null;
  synopsis: string | null;
  genres: string[];
  vibes: string[];
  providers: string[];
  providerUrl: string | null;
  watchLinks: WatchLink[];
  url: string | null;
  imageUrl: string | null;
  previewUrl: string | null;
  trailerUrl: string | null;
  director: string | null;
  cast: string[] | null;
  isFavorite: boolean;
}

export interface HistoryEntry {
  id: string;
  action: string;
  createdAt: string;
  suggestion: Suggestion;
}

export interface SuggestionFilter {
  type?: string;
  genres?: string[];
  subgenres?: string[];
  vibes?: string[];
  query?: string;
  decades?: number[];
  minRating?: number;
  country?: string;
}
