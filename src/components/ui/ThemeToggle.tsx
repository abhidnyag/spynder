"use client";

import { useTheme } from "@/context/ThemeContext";
import { Icon } from "./Icon";

/** Compact icon button that switches between dark and light themes (shows the target theme). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`grid size-9 flex-none place-items-center rounded-full border border-line text-sub transition active:scale-90 hover:text-ink ${className}`}
    >
      {/* Re-keyed on change so the icon pops when the theme flips. */}
      <Icon key={theme} name={theme === "dark" ? "sun" : "moon"} size={18} className="animate-[pop_0.3s_ease]" />
    </button>
  );
}
