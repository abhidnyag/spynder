import { describe, expect, it } from "vitest";
import { selectedDecades, withProviderDecade } from "../suggestion.service";

describe("selectedDecades", () => {
  it("returns the multi-select decades when present", () => {
    expect(selectedDecades({ decades: [1990, 2010] })).toEqual([1990, 2010]);
  });

  it("folds the legacy single `decade` into an array", () => {
    expect(selectedDecades({ decade: 1980 })).toEqual([1980]);
  });

  it("is empty when no decade is selected", () => {
    expect(selectedDecades({ genres: ["Rock"] })).toEqual([]);
    expect(selectedDecades(null)).toEqual([]);
  });
});

describe("withProviderDecade — resolves decades[] to the single `decade` providers read", () => {
  it("sets `decade` from a SINGLE selected decade (regression: was dropped, so the year filter never applied)", () => {
    // The UI stores even one pick in `decades`; providers read `filter.decade`, so it must resolve.
    expect(withProviderDecade({ genres: ["Blues"], country: "US", decades: [1990] })).toMatchObject({
      decade: 1990,
      decades: [1990],
    });
  });

  it("picks one of the selected decades when several are chosen", () => {
    const out = withProviderDecade({ decades: [1980, 1990, 2000] });
    expect([1980, 1990, 2000]).toContain(out?.decade);
  });

  it("leaves a decade-less filter untouched (no year constraint)", () => {
    const f = { genres: ["Rock"] };
    expect(withProviderDecade(f)?.decade).toBeUndefined();
  });
});
