import type { Mode } from "./taxonomy";
import { usePersistentState } from "./usePersistentState";

export type MovieType = "movie" | "series" | "either";

export interface CustomizeDraft {
  type: MovieType;
  genres: string[];
  vibes: string[];
  query: string; // the user's free-text description
  decade: number | null; // start year of the chosen decade (e.g. 1990); null = any
  minRating: number | null; // minimum rating on the mode's scale; null = any
  country: string | null; // ISO 3166-1 country code; null = any
}

export const EMPTY_DRAFT: CustomizeDraft = { type: "either", genres: [], vibes: [], query: "", decade: null, minRating: null, country: null };

/**
 * Persisted, per-mode customise draft. Shared by the Customize form and the Home
 * screen so a typed description is remembered for the next Surprise Me / Spin.
 */
export function useCustomizeDraft(mode: Mode) {
  return usePersistentState<CustomizeDraft>(`spynder.customize.${mode}`, EMPTY_DRAFT);
}
