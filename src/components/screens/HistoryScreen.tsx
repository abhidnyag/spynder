"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@apollo/client";
import { CLEAR_HISTORY, HISTORY } from "@/graphql/operations";
import type { HistoryEntry } from "@/types";
import type { Mode } from "@/lib/taxonomy";
import { useAuth } from "@/context/AuthContext";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { BottomNav } from "@/components/ui/BottomNav";

type Tab = "ALL" | "MUSIC" | "MOVIE" | "BOOK";

export function HistoryScreen() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("ALL");
  const { data, loading, refetch } = useQuery<{ history: HistoryEntry[] }>(HISTORY, {
    variables: { mode: tab === "ALL" ? null : (tab as Mode) },
    skip: !user,
  });
  const [clear] = useMutation(CLEAR_HISTORY, { onCompleted: () => refetch() });

  const entries = data?.history ?? [];

  if (!authLoading && !user) {
    return (
      <div className="flex flex-1 flex-col px-5 pt-3 sm:px-6 sm:pt-4">
        <ScreenHeader title="History" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Icon name="clock" size={40} className="text-faint" />
          <p className="text-sm leading-relaxed text-sub">
            Log in to keep your spins
            <br />
            and revisit past picks.
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
      <ScreenHeader title="History" action={{ label: "Clear", onClick: () => clear() }} />

      <div className="mt-2">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          label="Filter history by type"
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
        ) : entries.length === 0 ? (
          <li className="py-10 text-center text-sm leading-relaxed text-faint">
            Every spin is saved here —
            <br />
            never lose a good random pick.
          </li>
        ) : (
          entries.map((e) => <Row key={e.id} entry={e} />)
        )}
      </ul>

      <BottomNav />
    </div>
  );
}

function Row({ entry }: { entry: HistoryEntry }) {
  const { suggestion: s, action } = entry;
  // Consistent "<descriptor> · <action>": artist for music/books, type for movies/series.
  const descriptor = s.mode === "MOVIE" ? (s.type === "series" ? "Series" : "Movie") : s.artist;
  const subtitle = [descriptor, action].filter(Boolean).join(" · ");
  const inner = (
    <>
      <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-line bg-surface text-sub">
        {s.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote art, fixed size
          <img src={s.imageUrl} alt={s.title} className="h-full w-full object-cover" />
        ) : (
          <Icon name={s.mode === "MUSIC" ? "note" : s.mode === "BOOK" ? "book" : "popcorn"} size={20} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{s.title}</p>
        <p className="truncate text-xs text-sub">{subtitle}</p>
      </div>
      <Icon name={s.url ? "open" : "chevron"} size={18} className="text-faint" />
    </>
  );

  return (
    <li className="border-b border-line">
      {s.url ? (
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 py-3 transition active:scale-[0.99] active:opacity-70"
        >
          {inner}
        </a>
      ) : (
        <div className="flex items-center gap-3 py-3">{inner}</div>
      )}
    </li>
  );
}
