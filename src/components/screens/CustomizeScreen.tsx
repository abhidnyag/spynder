"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMode } from "@/context/ModeContext";
import { TAXONOMY, DECADES, RATINGS, COUNTRIES, availableSubgenres, type Mode } from "@/lib/taxonomy";
import { EMPTY_DRAFT, useCustomizeDraft, type MovieType } from "@/lib/useCustomizeDraft";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SuggestBox } from "@/components/ui/SuggestBox";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Icon } from "@/components/ui/Icon";

export function CustomizeScreen() {
  const { mode } = useMode();
  const router = useRouter();
  const tax = TAXONOMY[mode];
  const describe = DESCRIBE[mode];

  // Filters persist per mode, so each tab reopens with its last selection.
  const [draft, setDraft] = useCustomizeDraft(mode);
  const { type, genres, subgenres, vibes, query, decades, minRating, country } = draft;
  const patch = (p: Partial<typeof draft>) => setDraft({ ...draft, ...p });

  // Multi-select toggle shared by the genre/sub-genre/vibe chip groups.
  const toggle = (key: "genres" | "subgenres" | "vibes", value: string) => {
    const next = draft[key].includes(value) ? draft[key].filter((v) => v !== value) : [...draft[key], value];
    patch({ [key]: next });
  };

  const toggleDecade = (value: number) => {
    const next = decades.includes(value) ? decades.filter((d) => d !== value) : [...decades, value];
    patch({ decades: next });
  };

  // Sub-genres shown depend on the selected genre(s) and country (MUSIC only).
  const subOptions = availableSubgenres(mode, genres, country);
  const subKey = subOptions.map((s) => s.label).join("|");

  // Drop any selected sub-genre that's no longer offered (its genre/country was deselected),
  // so a hidden chip can't keep silently filtering. Keyed on the available set, not the
  // selection, so this can't loop.
  useEffect(() => {
    const valid = new Set(subKey.split("|").filter(Boolean));
    const pruned = subgenres.filter((s) => valid.has(s));
    if (pruned.length !== subgenres.length) patch({ subgenres: pruned });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subKey]);

  const surprise = () => {
    const params = new URLSearchParams({ mode });
    if (genres.length) params.set("genres", genres.join(","));
    if (mode === "MUSIC" && subgenres.length) params.set("subgenres", subgenres.join(","));
    if (vibes.length) params.set("vibes", vibes.join(","));
    if (query.trim()) params.set("q", query.trim());
    if (decades.length) params.set("decades", decades.join(","));
    if (minRating) params.set("rating", String(minRating));
    if (country) params.set("country", country);
    if (mode === "MOVIE" && type !== "either") params.set("type", type);
    router.push(`/result?${params.toString()}`);
  };

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pb-6 pt-3 sm:px-6 sm:pt-4">
      <ScreenHeader title="Customize" titleClassName="heading-strong" back action={{ label: "Reset", onClick: () => setDraft(EMPTY_DRAFT) }} />
      <p className="-mt-3 text-[13px] text-sub">Pick a mood — or leave blank for a total surprise</p>

      {mode === "MOVIE" && (
        <Section title="Type">
          <SegmentedControl<MovieType>
            value={type}
            onChange={(v) => patch({ type: v })}
            label="Type"
            options={[
              { value: "movie", label: "Movie" },
              { value: "series", label: "Series" },
              { value: "either", label: "Either" },
            ]}
          />
        </Section>
      )}

      <Section title="Genre">
        <ChipGroup options={[...tax.genres]} selected={genres} onToggle={(v) => toggle("genres", v)} />
      </Section>

      {mode === "MUSIC" && subOptions.length > 0 && (
        <Section title="Sub-genre">
          <ChipGroup
            options={subOptions.map((s) => s.label)}
            selected={subgenres}
            onToggle={(v) => toggle("subgenres", v)}
          />
        </Section>
      )}

      <Section title="Vibe">
        <ChipGroup options={[...tax.vibes]} selected={vibes} onToggle={(v) => toggle("vibes", v)} />
      </Section>

      <Section title="Decade">
        <MultiChipGroup options={DECADES} selected={decades} onToggle={toggleDecade} />
      </Section>

      {RATINGS[mode].length > 0 && (
        <Section title="Minimum rating">
          <SingleChipGroup options={RATINGS[mode]} value={minRating} onChange={(v) => patch({ minRating: v })} />
        </Section>
      )}

      <Section title="Country">
        <Select
          label="Country"
          hideLabel
          options={COUNTRIES.map((c) => ({ label: c.label, value: c.code }))}
          value={country}
          onChange={(v) => patch({ country: v })}
          placeholder="Any country"
        />
      </Section>

      <SuggestBox
        label={describe.label}
        placeholder={describe.placeholder}
        value={query}
        onChange={(v) => patch({ query: v })}
        onSubmit={surprise}
      />

      <Button onClick={surprise} className="mt-auto">
        <Icon name="dice" size={18} />
        Surprise me
      </Button>
    </div>
  );
}

// Per-mode copy for the free-text describe box.
const DESCRIBE: Record<Mode, { label: string; placeholder: string }> = {
  MUSIC: { label: "Or describe your mood", placeholder: "e.g. rainy Sunday morning, cleaning…" },
  MOVIE: { label: "Or describe what you’re after", placeholder: "e.g. short & funny, under 2 hours…" },
  BOOK: { label: "Or describe the book you want", placeholder: "e.g. cozy mystery, slow-burn romance…" },
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-faint">{title}</h2>
    {children}
  </section>
);

const ChipGroup = ({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) => (
  <div className="flex flex-wrap gap-2.5">
    {options.map((opt) => (
      <Chip key={opt} label={opt} selected={selected.includes(opt)} onClick={() => onToggle(opt)} />
    ))}
  </div>
);

// Multi-select chips for {label, value} options (decade): tapping toggles membership.
function MultiChipGroup<T extends string | number>({
  options,
  selected,
  onToggle,
}: {
  options: { label: string; value: T }[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => (
        <Chip key={String(opt.value)} label={opt.label} selected={selected.includes(opt.value)} onClick={() => onToggle(opt.value)} />
      ))}
    </div>
  );
}

// Single-select chips (rating): tapping the active chip clears it.
function SingleChipGroup<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => (
        <Chip
          key={String(opt.value)}
          label={opt.label}
          selected={value === opt.value}
          onClick={() => onChange(value === opt.value ? null : opt.value)}
        />
      ))}
    </div>
  );
}
