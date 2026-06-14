"use client";

import { createContext, useContext, useMemo } from "react";
import type { Mode } from "@/lib/taxonomy";
import { usePersistentState } from "@/lib/usePersistentState";

interface ModeContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

/**
 * Holds the active mode (Music/Movies), persisted across reloads, and renders the
 * app shell with the matching [data-mode] attribute, which swaps the --accent token.
 */
export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = usePersistentState<Mode>("spinder.mode", "MUSIC");
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ModeContext.Provider value={value}>
      <div
        data-mode={mode === "MOVIE" ? "movie" : "music"}
        className="no-scrollbar mx-auto flex min-h-dvh w-full max-w-app flex-col bg-bg"
      >
        {children}
      </div>
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
