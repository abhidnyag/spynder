"use client";

import { createContext, useContext, useMemo } from "react";
import type { Mode } from "@/lib/taxonomy";
import { usePersistentState } from "@/lib/usePersistentState";
import { SideNav } from "@/components/ui/SideNav";

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
  const [mode, setMode] = usePersistentState<Mode>("spynder.mode", "MUSIC");
  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ModeContext.Provider value={value}>
      {/* App shell. Phones/tablets (< lg): the centered 460px mobile column, unchanged. Desktop
          (lg+): a left SideNav + a wider, centered content column — a desktop-app layout. */}
      <div data-mode={mode.toLowerCase()} className="min-h-dvh bg-bg lg:flex">
        <SideNav />
        <div className="lg:flex lg:flex-1 lg:justify-center">
          <div className="no-scrollbar mx-auto flex min-h-dvh w-full max-w-app flex-col bg-bg lg:max-w-2xl">
            {children}
          </div>
        </div>
      </div>
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
