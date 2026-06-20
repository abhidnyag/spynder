import { useId } from "react";
import { Icon } from "./Icon";

interface SelectProps<T extends string> {
  /** Accessible name for the control (e.g. "Country"). */
  label: string;
  /** Hide the visible label, keeping it only for assistive tech. */
  hideLabel?: boolean;
  value: T | null;
  onChange: (value: T | null) => void;
  options: { value: T; label: string }[];
  /** Label for the empty/"any" choice (maps to `null`). */
  placeholder?: string;
}

/**
 * Accessible native-`<select>` dropdown styled with the app's tokens to match the
 * Button/Chip family (rounded-2xl surface, accent on hover/focus). A native select
 * keeps full keyboard/screen-reader behaviour and copes with long option lists
 * (e.g. every country) far better than a custom widget. The empty option maps to
 * `null` so callers get a clean "any" value.
 */
export function Select<T extends string>({ label, hideLabel, value, onChange, options, placeholder = "Any" }: SelectProps<T>) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "block text-xs text-sub"}>
        {label}
      </label>
      <div className="group relative">
        <select
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange((e.target.value || null) as T | null)}
          className={`peer w-full cursor-pointer appearance-none rounded-2xl border border-line bg-surface py-3.5 pl-4 pr-11 text-sm font-medium outline-none transition-[background-color,border-color] hover:border-accent hover:bg-surface-2 focus:border-accent ${
            value ? "text-ink" : "text-sub"
          }`}
        >
          <option value="" className="bg-surface text-ink">
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface text-ink">
              {opt.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevron"
          size={18}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-faint transition-colors peer-hover:text-accent peer-focus:text-accent"
        />
      </div>
    </div>
  );
}
