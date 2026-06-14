"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client";
import { RANDOM_SUGGESTION, RECORD_HISTORY, TOGGLE_FAVORITE } from "@/graphql/operations";
import { useMode } from "@/context/ModeContext";
import { useAuth } from "@/context/AuthContext";
import type { Mode } from "@/lib/taxonomy";
import type { Suggestion, SuggestionFilter } from "@/types";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { usePersistentState } from "@/lib/usePersistentState";

const openLink = (url: string | null) => url && window.open(url, "_blank", "noopener,noreferrer");

export function ResultScreen({ mode, filter }: { mode: Mode; filter: SuggestionFilter }) {
  const { setMode } = useMode();
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => setMode(mode), [mode, setMode]);

  const { data, loading, refetch } = useQuery<{ randomSuggestion: Suggestion | null }>(RANDOM_SUGGESTION, {
    variables: { mode, filter },
    notifyOnNetworkStatusChange: true,
  });
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

  const suggestion = data?.randomSuggestion ?? null;
  const spinAgain = () => refetch();

  // Favouriting requires an account; send anonymous users to sign in.
  const onFav = async () => {
    if (!user) return router.push("/profile");
    if (suggestion) await toggleFav({ variables: { suggestionId: suggestion.id } });
  };
  const onSkip = async () => {
    if (user && suggestion) await record({ variables: { suggestionId: suggestion.id, action: "skipped" } }).catch(() => {});
    spinAgain();
  };

  return (
    <div className="flex flex-1 flex-col px-5 pt-3 sm:px-6 sm:pt-4">
      <ScreenHeader title="Your pick" close />

      {loading && !suggestion ? (
        <ResultSkeleton mode={mode} />
      ) : !suggestion ? (
        <p className="mt-20 text-center text-sub">No suggestions yet — try seeding the database.</p>
      ) : mode === "MUSIC" ? (
        <SongResult key={suggestion.id} s={suggestion} onFav={onFav} onSkip={onSkip} onSpin={spinAgain} />
      ) : mode === "BOOK" ? (
        <BookResult key={suggestion.id} s={suggestion} onFav={onFav} onSkip={onSkip} onSpin={spinAgain} />
      ) : (
        <MovieResult key={suggestion.id} s={suggestion} onFav={onFav} onSkip={onSkip} onSpin={spinAgain} />
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
      <MetaChips items={[...s.genres, ...s.vibes, s.year]} />

      {s.previewUrl ? <PreviewPlayer src={s.previewUrl} /> : <NoPreviewBar url={s.url} />}

      <ActionRow actions={[
        { icon: s.isFavorite ? "heartFilled" : "heart", label: s.isFavorite ? "Saved" : "Save", onClick: onFav, active: s.isFavorite },
        { icon: "open", label: "Open", onClick: () => openLink(s.url) },
        { icon: "skip", label: "Skip", onClick: onSkip },
      ]} />
      <SpinAgain onClick={onSpin} />
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
  const [volume, setVolume] = usePersistentState("spinder.volume", 0.8);
  const [muted, setMuted] = usePersistentState("spinder.muted", false);

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
        <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="flex-none text-sub transition active:scale-90">
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

      {s.providers.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {s.providers.map((p) => (
            <span key={p} className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-semibold text-sub">
              {p}
            </span>
          ))}
        </div>
      )}

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

      {s.providers.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {s.providers.map((p) => (
            <span key={p} className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-semibold text-sub">
              {p}
            </span>
          ))}
        </div>
      )}

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
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div className="w-full max-w-app" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end pb-2">
          <button onClick={onClose} aria-label="Close trailer" className="text-sub">
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
  return (
    <div
      onClick={onClick}
      className={`mt-4 grid place-items-center overflow-hidden rounded-2xl border border-line bg-surface ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote art, sized by parent
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <Icon name={icon} size={52} className="text-faint" />
      )}
    </div>
  );
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
        <button
          key={a.label}
          onClick={a.onClick}
          className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-semibold transition-[transform,background-color] duration-100 active:scale-95 active:bg-surface-2 ${
            a.active ? "border-accent text-accent" : "border-line text-sub"
          }`}
        >
          {/* keyed so toggling to "active" (e.g. favourited) replays the pop */}
          <Icon key={a.active ? "on" : "off"} name={a.icon} size={18} className={a.active ? "animate-[pop_0.3s_ease]" : ""} />
          {a.label}
        </button>
      ))}
    </div>
  );
}

const SpinAgain = ({ onClick }: { onClick: () => void }) => (
  <Button variant="outline" onClick={onClick} className="group mt-4">
    <Icon name="dice" size={18} className="transition-transform duration-300 group-active:rotate-180" />
    Spin again
  </Button>
);

function ResultSkeleton({ mode }: { mode: Mode }) {
  return (
    <div className="flex flex-1 animate-pulse flex-col items-center pt-10">
      <div className={`rounded-2xl bg-surface ${mode === "MUSIC" ? "h-52 w-52" : "h-56 w-40"}`} />
      <div className="mt-6 h-6 w-44 rounded bg-surface" />
      <div className="mt-3 h-4 w-28 rounded bg-surface" />
    </div>
  );
}
