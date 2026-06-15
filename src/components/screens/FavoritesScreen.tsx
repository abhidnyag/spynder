"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@apollo/client";
import { FAVORITES, TOGGLE_FAVORITE } from "@/graphql/operations";
import type { Suggestion } from "@/types";
import type { Mode } from "@/lib/taxonomy";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { BottomNav } from "@/components/ui/BottomNav";

type Tab = "ALL" | "MUSIC" | "MOVIE" | "BOOK";

export function FavoritesScreen() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("ALL");
  const { data, loading, refetch } = useQuery<{ favorites: Suggestion[] }>(FAVORITES, {
    variables: { mode: tab === "ALL" ? null : (tab as Mode) },
    skip: !user,
  });
  const [toggle] = useMutation(TOGGLE_FAVORITE, { onCompleted: () => refetch() });

  const items = data?.favorites ?? [];

  if (!authLoading && !user) {
    return (
      <div className="flex flex-1 flex-col px-5 pt-3 sm:px-6 sm:pt-4">
        <ScreenHeader title="Saved" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Icon name="heart" size={40} className="text-faint" />
          <p className="text-sm leading-relaxed text-sub">
            Log in to favourite songs
            <br />
            and titles you love.
          </p>
          <Link href="/profile" className="w-full max-w-[220px]">
            <Button>Log in or register</Button>
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-5 pt-3 sm:px-6 sm:pt-4">
      <ScreenHeader title="Saved" />
      <div className="mt-2">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          label="Filter saved by type"
          options={[
            { value: "ALL", label: "All" },
            { value: "MUSIC", label: "Music" },
            { value: "MOVIE", label: "Watch" },
            { value: "BOOK", label: "Books" },
          ]}
        />
      </div>

      <ul className="mt-4 flex-1">
        {loading ? (
          <li role="status" className="py-10 text-center text-sub">Loading…</li>
        ) : items.length === 0 ? (
          <li className="py-10 text-center text-sm leading-relaxed text-faint">
            No favourites yet — tap the heart
            <br />
            on a pick to save it here.
          </li>
        ) : (
          items.map((s) => {
            const meta =
              s.mode === "MUSIC"
                ? s.artist
                : s.mode === "BOOK"
                  ? [s.artist, s.year].filter(Boolean).join(" · ")
                  : [s.type === "series" ? "Series" : "Movie", s.year].filter(Boolean).join(" · ");
            const cover = (
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-line bg-surface text-sub">
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote art, fixed size
                  <img src={s.imageUrl} alt={s.title} className="h-full w-full object-cover" />
                ) : (
                  <Icon name={s.mode === "MUSIC" ? "note" : s.mode === "BOOK" ? "book" : "popcorn"} size={20} />
                )}
              </span>
            );
            const text = (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.title}</p>
                <p className="truncate text-xs text-sub">{meta}</p>
              </div>
            );
            return (
              <li key={s.id} className="flex items-center gap-3 border-b border-line py-3">
                {/* Open the pick's page; the heart stays outside the link so removing doesn't navigate. */}
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-3 transition active:scale-[0.99] active:opacity-70"
                  >
                    {cover}
                    {text}
                  </a>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {cover}
                    {text}
                  </div>
                )}
                <button
                  onClick={() => toggle({ variables: { suggestionId: s.id } })}
                  aria-label="Remove from favourites"
                  className="flex-none text-accent transition active:scale-90"
                >
                  <Icon name="heartFilled" size={20} />
                </button>
              </li>
            );
          })
        )}
      </ul>

      <BottomNav />
    </div>
  );
}
