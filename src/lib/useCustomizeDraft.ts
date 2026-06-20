import type { Mode } from "./taxonomy";
import { usePersistentState } from "./usePersistentState";

export type MovieType = "movie" | "series" | "either";

export interface CustomizeDraft {
  type: MovieType;
  genres: string[];
  subgenres: string[]; // MUSIC sub-genre labels (e.g. "Punk Rock"); [] for other modes
  vibes: string[];
  query: string; // the user's free-text description
  decades: number[]; // start years of the chosen decades (e.g. [1990, 2010]); [] = any
  minRating: number | null; // minimum rating on the mode's scale; null = any
  country: string | null; // ISO 3166-1 country code; null = any
}

export const EMPTY_DRAFT: CustomizeDraft = {
  type: "either",
  genres: [],
  subgenres: [],
  vibes: [],
  query: "",
  decades: [],
  minRating: null,
  country: null,
};

/**
 * Coerce a persisted (possibly older-shaped) draft into the current shape: fills in
 * any missing fields and migrates the legacy single `decade` into the `decades` array,
 * so users with an existing saved filter don't hit `undefined.includes`.
 */
function normalizeDraft(d: Partial<CustomizeDraft> & { decade?: number | null }): CustomizeDraft {
  const decades = d.decades?.length ? d.decades : typeof d.decade === "number" ? [d.decade] : [];
  return {
    type: d.type ?? EMPTY_DRAFT.type,
    genres: d.genres ?? [],
    subgenres: d.subgenres ?? [],
    vibes: d.vibes ?? [],
    query: d.query ?? "",
    decades,
    minRating: d.minRating ?? null,
    country: d.country ?? null,
  };
}

/**
 * Persisted, per-mode customise draft. Shared by the Customize form and the Home
 * screen so a typed description is remembered for the next Surprise Me / Spin.
 */
export function useCustomizeDraft(mode: Mode) {
  const [stored, setStored] = usePersistentState<CustomizeDraft>(`spynder.customize.${mode}`, EMPTY_DRAFT);
  return [normalizeDraft(stored), setStored] as const;
}
