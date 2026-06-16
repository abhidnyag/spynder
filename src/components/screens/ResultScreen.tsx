"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client";
import { RANDOM_SUGGESTION, RECORD_HISTORY, TOGGLE_FAVORITE, TRACK_PREVIEW } from "@/graphql/operations";
import { useMode } from "@/context/ModeContext";
import { useAuth } from "@/context/AuthContext";
import { MODE_META, type Mode } from "@/lib/taxonomy";
import type { Suggestion, SuggestionFilter, WatchLink } from "@/types";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { usePersistentState } from "@/lib/usePersistentState";

const openLink = (url: string | null) => url && window.open(url, "_blank", "noopener,noreferrer");

/**
 * The viewer's country as an ISO 3166-1 code, read from their browser locale
 * (e.g. "en-IN" → "IN"), so TMDB surfaces the streaming services available where
 * they are. Defaults to "US" when the region can't be determined.
 */
function detectRegion(): string {
  if (typeof navigator === "undefined") return "US";
  try {
    const region = new Intl.Locale(navigator.language).region;
    if (region) return region.toUpperCase();
  } catch {
    /* fall through to manual parse */
  }
  return (navigator.language.split("-")[1] ?? "US").toUpperCase();
}

export function ResultScreen({ mode, filter }: { mode: Mode; filter: SuggestionFilter }) {
  const { setMode } = useMode();
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => setMode(mode), [mode, setMode]);
  // Resolved once from the browser locale; tailors movie/series providers to the viewer's country.
  const [region] = useState(detectRegion);

  const { data, loading, refetch } = useQuery<{ randomSuggestion: Suggestion | null }>(RANDOM_SUGGESTION, {
    variables: { mode, filter, region },
    notifyOnNetworkStatusChange: true,
  });

  const suggestion = data?.randomSuggestion ?? null;
  const filtersApplied = hasActiveFilters(filter);
  const noMatch = !loading && !suggestion && filtersApplied;

  // Nothing matched the filters → fall back to an UNFILTERED random pick, shown
  // beneath a notice, so the user always gets a suggestion rather than a dead end.
  const {
    data: fbData,
    loading: fbLoading,
    refetch: refetchFallback,
  } = useQuery<{ randomSuggestion: Suggestion | null }>(RANDOM_SUGGESTION, {
    variables: { mode, filter: {}, region },
    skip: !noMatch,
    notifyOnNetworkStatusChange: true,
  });
  const fallback = fbData?.randomSuggestion ?? null;

  const [record] = useMutation(RECORD_HISTORY);
  // Toggle favourite and update the cached Suggestion in place (no re-roll).
  const [toggleFav] = useMutation(TOGGLE_FAVORITE, {
    update: (cache, { data: res }, { variables }) => {
      cache.modify({
        id: cache.identify({ __typename: "Suggestion", id: variables!.suggestionId }),
        fields: { isFavorite: () => Boolean(res?.toggleFavorite) },
      });
    },
  });

  // Action handlers bound to a specific suggestion + its re-roll — used for both the
  // filtered pick and the random fallback. Favouriting requires an account.
  const handlers = (s: Suggestion | null, spin: () => void): ResultProps => ({
    s: s as Suggestion,
    onSpin: spin,
    onFav: async () => {
      if (!user) return router.push("/profile");
      if (s) await toggleFav({ variables: { suggestionId: s.id } });
    },
    onSkip: async () => {
      if (user && s) await record({ variables: { suggestionId: s.id, action: "skipped" } }).catch(() => {});
      spin();
    },
  });

  return (
    <div className="flex flex-1 flex-col px-5 pt-3 sm:px-6 sm:pt-4">
      <ScreenHeader title="Your pick" close />

      {loading && !suggestion ? (
        // First load (e.g. "Surprise Me") → spinner.
        <SpinLoader mode={mode} />
      ) : loading ? (
        // Re-rolls ("Spin again"/"Skip") → skeleton in the shape of the next result.
        <ResultSkeleton mode={mode} />
      ) : suggestion ? (
        <ResultCard mode={mode} {...handlers(suggestion, () => refetch())} />
      ) : noMatch ? (
        // No filter match → tell the user, then show a random pick for the mode below.
        <div className="flex flex-1 flex-col">
          <NoMatchNotice mode={mode} />
          {fbLoading && !fallback ? (
            <SpinLoader mode={mode} />
          ) : fallback ? (
            <ResultCard mode={mode} {...handlers(fallback, () => refetchFallback())} />
          ) : (
            <EmptyState filter={filter} />
          )}
        </div>
      ) : (
        <EmptyState filter={filter} />
      )}
    </div>
  );
}

/* ----------------------------- music ----------------------------- */
function SongResult({ s, onFav, onSkip, onSpin }: ResultProps) {
  return (
    <div className="reveal flex flex-1 flex-col items-center pt-2 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Random song for you</p>
      <Media src={s.imageUrl} alt={s.title} icon="note" className="size-[clamp(11rem,52vw,13rem)]" />
      <h2 className="mt-5 text-2xl font-extrabold sm:text-3xl">{s.title}</h2>
      <p className="mt-1 text-sub">{s.artist}</p>
      {/* Year keeps its chip styling; genres (Spotify artist data) and any vibes
          sit just below as bullet-separated lines. */}
      <MetaChips items={[s.year]} />
      {s.genres.length > 0 && <p className="mt-2 text-[13px] text-sub">{s.genres.join(" · ")}</p>}
      {s.vibes.length > 0 && <p className="mt-1 text-[13px] text-sub">{s.vibes.join(" · ")}</p>}

      <MusicPreview s={s} />

      <ActionRow actions={[
        { icon: s.isFavorite ? "heartFilled" : "heart", label: s.isFavorite ? "Saved" : "Save", onClick: onFav, active: s.isFavorite },
        { icon: "open", label: "Open", onClick: () => openLink(s.url) },
        { icon: "skip", label: "Skip", onClick: onSkip },
      ]} />
      <SpinAgain onClick={onSpin} />
    </div>
  );
}

/**
 * The 30-sec preview, resolved lazily. Spotify omits `previewUrl` for newer apps,
 * so we fetch it via `trackPreview` *after* the result is shown (the scrape is
 * slow) — the player fills in a moment later rather than holding up the spin.
 */
function MusicPreview({ s }: { s: Suggestion }) {
  const needLazy = !s.previewUrl && s.source === "spotify";
  const { data, loading } = useQuery<{ trackPreview: string | null }>(TRACK_PREVIEW, {
    variables: { id: s.id },
    skip: !needLazy,
  });
  const src = s.previewUrl ?? data?.trackPreview ?? null;
  if (src) return <PreviewPlayer src={src} />;
  if (needLazy && loading) return <PreviewLoadingBar />;
  return <NoPreviewBar url={s.url} />;
}

function PreviewLoadingBar() {
  return (
    <div role="status" className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-surface-2">
        <Icon name="note" size={18} className="animate-pulse text-accent" />
      </span>
      <div className="flex-1 space-y-2">
        <div className="h-2.5 w-24 animate-pulse rounded bg-surface-2" />
        <div className="h-2 w-16 animate-pulse rounded bg-surface-2" />
      </div>
      <span className="text-[10px] text-faint">Loading preview…</span>
    </div>
  );
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** 30-sec preview player with play/pause, seek, and volume/mute. */
function PreviewPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(30);
  // Volume + mute persist across songs and reloads.
  const [volume, setVolume] = usePersistentState("spynder.volume", 0.8);
  const [muted, setMuted] = usePersistentState("spynder.muted", false);

  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.volume = volume;
      a.muted = muted;
    }
  }, [volume, muted]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  return (
    <div className="mt-6 w-full rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play preview"}
          className="grid h-12 w-12 flex-none place-items-center rounded-full bg-accent text-white transition duration-100 active:scale-90 active:brightness-110"
        >
          <Icon key={playing ? "pause" : "play"} name={playing ? "pause" : "play"} size={18} className="animate-[pop_0.25s_ease]" />
        </button>
        <input
          type="range"
          className="range flex-1"
          min={0}
          max={duration}
          step={0.1}
          value={current}
          aria-label="Seek"
          onChange={(e) => {
            const v = Number(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = v;
            setCurrent(v);
          }}
        />
        <span className="w-16 flex-none text-right text-[10px] tabular-nums text-faint">
          {fmtTime(current)} / {fmtTime(duration)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="flex-none text-sub transition active:scale-90">
          <Icon name={muted || volume === 0 ? "mute" : "volume"} size={18} />
        </button>
        <input
          type="range"
          className="range w-24"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          aria-label="Volume"
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            setMuted(v === 0);
          }}
        />
        <span className="ml-auto text-[10px] text-faint">Spotify preview</span>
      </div>

      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 30)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
      />
    </div>
  );
}

function NoPreviewBar({ url }: { url: string | null }) {
  return (
    <button
      type="button"
      onClick={() => openLink(url)}
      className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition active:scale-[0.99]"
    >
      <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-accent text-white">
        <Icon name="open" size={18} />
      </span>
      <div>
        <p className="text-sm font-semibold">Listen on Spotify</p>
        <p className="text-[11px] text-faint">No 30-sec preview available</p>
      </div>
    </button>
  );
}

/* ----------------------------- movie ----------------------------- */
function MovieResult({ s, onFav, onSkip, onSpin }: ResultProps) {
  const [showTrailer, setShowTrailer] = useState(false);
  const embedUrl = s.trailerUrl ? s.trailerUrl.replace("watch?v=", "embed/") : null;

  const metaLine = [s.rating && `★ ${s.rating.toFixed(1)}`, s.type === "series" ? "Series" : "Movie", s.year, s.runtime]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="reveal flex flex-1 flex-col items-center pt-2 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Watch this tonight</p>
      <Media src={s.imageUrl} alt={s.title} icon="popcorn" className="h-[clamp(13rem,60vw,14rem)] w-[clamp(9.5rem,42vw,10rem)]" onClick={() => openLink(s.url)} />
      <h2 className="mt-4 text-xl font-extrabold leading-tight sm:text-2xl">{s.title}</h2>
      <p className="mt-2 text-[13px] font-semibold text-sub">{metaLine}</p>
      <MetaChips items={s.genres} />
      <Credits director={s.director} cast={s.cast} />
      {s.synopsis && <p className="mt-4 line-clamp-4 text-[13px] leading-relaxed text-sub">{s.synopsis}</p>}

      <Providers items={s.providers} links={s.watchLinks} />

      <ActionRow actions={[
        { icon: s.isFavorite ? "heartFilled" : "heart", label: s.isFavorite ? "Saved" : "Watchlist", onClick: onFav, active: s.isFavorite },
        { icon: "play", label: "Trailer", onClick: () => (embedUrl ? setShowTrailer(true) : openLink(s.url)) },
        { icon: "skip", label: "Seen it", onClick: onSkip },
      ]} />
      <SpinAgain onClick={onSpin} />

      {showTrailer && embedUrl && <TrailerOverlay embedUrl={embedUrl} onClose={() => setShowTrailer(false)} />}
    </div>
  );
}

/* ------------------------------ book ------------------------------ */
function BookResult({ s, onFav, onSkip, onSpin }: ResultProps) {
  const metaLine = [s.rating && `★ ${s.rating.toFixed(1)}`, s.year, s.runtime].filter(Boolean).join("  ·  ");

  return (
    <div className="reveal flex flex-1 flex-col items-center pt-2 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-accent">Read this next</p>
      <Media src={s.imageUrl} alt={s.title} icon="book" className="h-[clamp(13rem,60vw,14rem)] w-[clamp(9.5rem,42vw,10rem)]" onClick={() => openLink(s.url)} />
      <h2 className="mt-4 text-xl font-extrabold leading-tight sm:text-2xl">{s.title}</h2>
      {s.artist && <p className="mt-1 text-sub">{s.artist}</p>}
      {metaLine && <p className="mt-2 text-[13px] font-semibold text-sub">{metaLine}</p>}
      <MetaChips items={s.genres} />
      {s.synopsis && <p className="mt-4 line-clamp-4 text-[13px] leading-relaxed text-sub">{s.synopsis}</p>}

      <Providers items={s.providers} links={s.watchLinks} />

      <ActionRow actions={[
        { icon: s.isFavorite ? "heartFilled" : "heart", label: s.isFavorite ? "Saved" : "Reading list", onClick: onFav, active: s.isFavorite },
        { icon: "open", label: "Details", onClick: () => openLink(s.url) },
        { icon: "skip", label: "Read it", onClick: onSkip },
      ]} />
      <SpinAgain onClick={onSpin} />
    </div>
  );
}

function TrailerOverlay({ embedUrl, onClose }: { embedUrl: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Move focus into the dialog and let Escape close it (expected dialog behaviour).
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Trailer" className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div className="w-full max-w-app" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end pb-2">
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close trailer" className="text-sub">
            <Icon name="close" size={22} />
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-line bg-black">
          <iframe
            src={`${embedUrl}?autoplay=1`}
            title="Trailer"
            className="h-full w-full"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

/* --------------------------- primitives --------------------------- */
interface ResultProps {
  s: Suggestion;
  onFav: () => void;
  onSkip: () => void;
  onSpin: () => void;
}

interface Action {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
}

function Media({ src, alt, icon, className, onClick }: { src: string | null; alt: string; icon: IconName; className: string; onClick?: () => void }) {
  const inner = src ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote art, sized by parent
    <img src={src} alt={alt} className="h-full w-full object-cover" />
  ) : (
    <Icon name={icon} size={52} className="text-faint" />
  );
  const base = `mt-4 grid place-items-center overflow-hidden rounded-2xl border border-line bg-surface ${className}`;
  // When tappable (movie/book poster → external page), render a real button so
  // it's keyboard-focusable and activatable, not a click-only div.
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={`Open ${alt}`} className={`${base} cursor-pointer transition active:scale-[0.99]`}>
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}

function MetaChips({ items }: { items: (string | number | null)[] }) {
  const chips = items.filter(Boolean).map(String);
  if (!chips.length) return null;
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      {chips.map((c) => (
        <Chip key={c} label={c} readOnly />
      ))}
    </div>
  );
}

// Two provider/service names refer to the same platform, comparing on alphanumerics
// only ("Disney+" ≈ "Disney Plus", "Amazon Prime Video" ≈ "Prime Video").
const normalizeProvider = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const sameProvider = (a: string, b: string) => {
  const x = normalizeProvider(a);
  const y = normalizeProvider(b);
  return x === y || x.includes(y) || y.includes(x);
};

/**
 * Where-to-watch chips. TMDB provider names (region-correct) are shown and become a
 * direct link when Watchmode resolved a deep link for that service. Any Watchmode
 * deep link not matched to a TMDB provider is appended too, so no link is lost (e.g.
 * TMDB listed no providers, or Watchmode knows a service TMDB didn't).
 */
function Providers({ items, links }: { items: string[]; links: WatchLink[] }) {
  const chipClass = "rounded-lg border border-line px-3 py-1.5 text-[11px] font-semibold text-sub";
  const chips: { label: string; url: string | null }[] = items.map((p) => ({
    label: p,
    url: links.find((l) => sameProvider(l.name, p))?.url ?? null,
  }));
  for (const l of links) if (!chips.some((c) => sameProvider(c.label, l.name))) chips.push({ label: l.name, url: l.url });

  if (!chips.length) return null;
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {chips.map((c, i) =>
        c.url ? (
          <a
            key={`${c.label}-${i}`}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${chipClass} transition hover:border-accent hover:text-accent active:scale-95`}
          >
            {c.label}
          </a>
        ) : (
          <span key={`${c.label}-${i}`} className={chipClass}>
            {c.label}
          </span>
        ),
      )}
    </div>
  );
}

/** Director + top-billed cast for a movie/series, shown under the genre chips. */
function Credits({ director, cast }: { director: string | null; cast: string[] | null }) {
  const rows = [
    director ? { label: "Director", value: director } : null,
    cast?.length ? { label: "Cast", value: cast.join(", ") } : null,
  ].filter(Boolean) as { label: string; value: string }[];
  if (!rows.length) return null;
  return (
    <div className="mt-3 space-y-0.5 text-[12px] leading-snug text-sub">
      {rows.map((r) => (
        <p key={r.label}>
          <span className="text-faint">{r.label} · </span>
          {r.value}
        </p>
      ))}
    </div>
  );
}

function ActionRow({ actions }: { actions: Action[] }) {
  return (
    <div className="mt-5 flex w-full gap-2.5">
      {actions.map((a) => (
        <ActionButton key={a.label} action={a} />
      ))}
    </div>
  );
}

function ActionButton({ action }: { action: Action }) {
  // Bumped on every tap so the icon's pop replays each click (a mild bounce),
  // mirroring the feedback the Favourite toggle already gives when it flips.
  const [taps, setTaps] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        setTaps((n) => n + 1);
        action.onClick();
      }}
      aria-pressed={action.active}
      className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-semibold transition-[transform,background-color,border-color,color] duration-100 hover:bg-surface-2 active:scale-95 active:bg-surface-2 ${
        action.active ? "border-accent text-accent" : "border-line text-sub hover:border-accent hover:text-ink"
      }`}
    >
      {/* Re-keyed on each tap (and on active flips) so the pop animation replays. */}
      <Icon
        key={`${action.active ? "on" : "off"}-${taps}`}
        name={action.icon}
        size={18}
        className={action.active || taps > 0 ? "animate-[pop_0.3s_ease]" : ""}
      />
      {action.label}
    </button>
  );
}

function SpinAgain({ onClick }: { onClick: () => void }) {
  // Re-keyed on each click so the dice replays its roll-and-bounce every spin
  // (a single `active:` transition only fired while held and reverted on release).
  const [rolls, setRolls] = useState(0);
  return (
    <Button
      variant="outline"
      onClick={() => {
        setRolls((n) => n + 1);
        onClick();
      }}
      className="mt-4"
    >
      <Icon key={rolls} name="dice" size={18} className={rolls > 0 ? "animate-[dice-roll_0.55s_ease]" : ""} />
      Spin again
    </Button>
  );
}

/** Whether the user narrowed the spin at all (drives the no-match fallback + copy). */
const hasActiveFilters = (f: SuggestionFilter) =>
  Boolean(
    f.decade ||
      f.minRating ||
      f.country ||
      (f.type && f.type !== "either") ||
      f.genres?.length ||
      f.vibes?.length ||
      (f.query ?? "").trim(),
  );

/** Renders the right result card for the mode. Keyed so a new pick remounts. */
function ResultCard({ mode, s, onFav, onSkip, onSpin }: { mode: Mode } & ResultProps) {
  if (mode === "MUSIC") return <SongResult key={s.id} s={s} onFav={onFav} onSkip={onSkip} onSpin={onSpin} />;
  if (mode === "BOOK") return <BookResult key={s.id} s={s} onFav={onFav} onSkip={onSkip} onSpin={onSpin} />;
  return <MovieResult key={s.id} s={s} onFav={onFav} onSkip={onSkip} onSpin={onSpin} />;
}

/** Banner shown above the random fallback when nothing matched the filters. */
function NoMatchNotice({ mode }: { mode: Mode }) {
  const label = mode === "MUSIC" ? "song" : mode === "BOOK" ? "book" : "title";
  return (
    <div role="status" className="reveal mt-2 rounded-2xl border border-line bg-surface px-4 py-3 text-center">
      <p className="text-sm font-semibold">No matches for those filters</p>
      <p className="mt-1 text-[12px] leading-relaxed text-sub">
        Nothing fit everything you picked — here&apos;s a random {label} instead. Loosen a filter and spin again.
      </p>
    </div>
  );
}

/** Genuinely empty catalogue (no filters, nothing seeded) — distinct from a no-match. */
function EmptyState({ filter }: { filter: SuggestionFilter }) {
  const hasFilters = hasActiveFilters(filter);
  return (
    <div role="status" className="mt-20 flex flex-col items-center gap-2 px-6 text-center">
      <p className="text-sub">{hasFilters ? "No matches — and no random pick either." : "No suggestions yet — try seeding the database."}</p>
    </div>
  );
}

/**
 * Skeleton placeholder shaped like the upcoming result (square art for music,
 * portrait poster for movies/books). Shown on the first load — e.g. "Surprise
 * Me" — where there's no prior result to keep on screen.
 */
function ResultSkeleton({ mode }: { mode: Mode }) {
  const art = mode === "MUSIC" ? "size-[clamp(11rem,52vw,13rem)]" : "h-[clamp(13rem,60vw,14rem)] w-[clamp(9.5rem,42vw,10rem)]";
  return (
    <div role="status" aria-label="Loading your pick" className="reveal flex flex-1 animate-pulse flex-col items-center pt-2">
      <div className="h-3 w-32 rounded bg-surface" />
      <div className={`mt-4 rounded-2xl bg-surface ${art}`} />
      <div className="mt-5 h-6 w-48 rounded bg-surface" />
      <div className="mt-3 h-4 w-28 rounded bg-surface" />
      <div className="mt-4 flex gap-2">
        <div className="h-7 w-16 rounded-lg bg-surface" />
        <div className="h-7 w-16 rounded-lg bg-surface" />
      </div>
    </div>
  );
}

/**
 * Animated, mode-aware loader shown while a pick is being fetched. A live spin
 * hits an external API (Spotify/TMDB/Open Library), which can take a second, so
 * this gives clear "we're working on it" feedback — announced via role="status".
 */
function SpinLoader({ mode }: { mode: Mode }) {
  const icon: IconName = mode === "MUSIC" ? "note" : mode === "BOOK" ? "book" : "popcorn";
  return (
    <div role="status" aria-live="polite" className="reveal flex flex-1 flex-col items-center justify-center gap-6 pb-20 text-center">
      <div className="relative grid place-items-center">
        {/* Expanding ring pulse behind the spinning dice. */}
        <span className="absolute size-24 animate-ping rounded-full border border-accent opacity-25" />
        <span className="grid size-20 place-items-center rounded-3xl border border-line bg-surface">
          <Icon name="dice" size={32} className="animate-spin text-accent [animation-duration:1.1s]" />
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold">Finding your pick…</p>
        <p className="flex items-center justify-center gap-1.5 text-[12px] text-faint">
          <Icon name={icon} size={14} className="animate-pulse" />
          Shuffling the {MODE_META[mode].label.toLowerCase()} catalogue
        </p>
      </div>
    </div>
  );
}
