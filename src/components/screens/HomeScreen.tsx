"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMode } from "@/context/ModeContext";
import { MODE_META, type Mode } from "@/lib/taxonomy";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { BottomNav } from "@/components/ui/BottomNav";
import { UserAvatar } from "@/components/ui/UserAvatar";

const COPY: Record<Mode, { sub: string; caption: [string, string] }> = {
  MUSIC: {
    sub: "tap for a random song",
    caption: ["One tap, one random song.", "No browsing, no overthinking."],
  },
  MOVIE: {
    sub: "random movie or series",
    caption: ["Stop scrolling for 40 minutes.", "One tap, one thing to watch."],
  },
  BOOK: {
    sub: "tap for a random read",
    caption: ["Skip the endless to-read list.", "One tap, one book to start."],
  },
};

export function HomeScreen() {
  const { mode, setMode } = useMode();
  const router = useRouter();
  const meta = MODE_META[mode];

  // Home is the pure-random tap; use Customize to spin with genres/vibes/a description.
  const surprise = () => router.push(`/result?mode=${mode}`);

  return (
    <div className="flex flex-1 flex-col px-5 pt-3 sm:px-6 sm:pt-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-sub">Hey there</p>
          <h1 className="text-xl font-bold sm:text-2xl">{meta.greeting}</h1>
        </div>
        <UserAvatar />
      </header>

      <div className="mt-5">
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "MUSIC", label: "Music" },
            { value: "MOVIE", label: "Movies" },
            { value: "BOOK", label: "Books" },
          ]}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 sm:gap-8">
        <button
          onClick={surprise}
          className="group grid size-[clamp(11rem,52vw,13rem)] place-items-center rounded-full border border-accent transition active:scale-95"
        >
          <span className="flex size-[clamp(9rem,44vw,11rem)] flex-col items-center justify-center gap-1.5 rounded-full bg-surface px-5 text-center transition-colors duration-100 group-active:bg-surface-2">
            <Icon name="shuffle" size={38} className="text-ink transition-transform duration-300 group-active:rotate-180" />
            <span className="text-[15px] font-bold leading-none">Surprise Me</span>
            <span className="text-[11px] leading-snug text-sub">{COPY[mode].sub}</span>
          </span>
        </button>

        <p className="text-center text-[13px] leading-relaxed text-sub">
          {COPY[mode].caption[0]}
          <br />
          <span className="text-faint">{COPY[mode].caption[1]}</span>
        </p>

        <Link
          href="/customize"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3.5 text-sm font-semibold text-ink"
        >
          <Icon name="sliders" size={18} className="text-sub" />
          Pick a genre or vibe
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
