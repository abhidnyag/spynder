"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { usePersistentState } from "@/lib/usePersistentState";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Holds the active colour theme (dark/light), persisted across reloads, and reflects it as a
 * `[data-theme]` attribute on <html> so the CSS variables in globals.scss swap app-wide. An
 * inline script in layout.tsx sets the same attribute before first paint to avoid a flash;
 * this keeps it in sync after hydration and on every toggle. The mode accent (data-mode) is
 * independent, so each works in either theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = usePersistentState<Theme>("spynder.theme", "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
