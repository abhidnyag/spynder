import type { Mode } from "./taxonomy";
import { usePersistentState } from "./usePersistentState";

export type MovieType = "movie" | "series" | "either";

export interface CustomizeDraft {
  type: MovieType;
  genres: string[];
  vibes: string[];
  query: string; // the user's free-text description
}

export const EMPTY_DRAFT: CustomizeDraft = { type: "either", genres: [], vibes: [], query: "" };

/**
 * Persisted, per-mode customise draft. Shared by the Customize form and the Home
 * screen so a typed description is remembered for the next Surprise Me / Spin.
 */
export function useCustomizeDraft(mode: Mode) {
  return usePersistentState<CustomizeDraft>(`spynder.customize.${mode}`, EMPTY_DRAFT);
}
