"use client";

import { useEffect, useId, useRef, useState } from "react";
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

type Item<T extends string> = { value: T | null; label: string };

/**
 * Accessible custom-listbox dropdown (WAI-ARIA "select-only combobox" pattern). A
 * custom popup is used instead of a native `<select>` so the option list and its
 * scrollbar can be themed to match the rest of the UI — native option popups aren't
 * styleable across browsers. Full keyboard support is preserved: arrows/Home/End to
 * move, Enter/Space to choose, Escape to close, and type-ahead. The empty option
 * maps to `null` so callers get a clean "any" value.
 */
export function Select<T extends string>({ label, hideLabel, value, onChange, options, placeholder = "Any" }: SelectProps<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const labelId = `${id}-label`;

  // The "any" choice is the first item; everything is index-addressable for keyboard nav.
  const items: Item<T>[] = [{ value: null, label: placeholder }, ...options];
  const selectedIndex = Math.max(0, items.findIndex((it) => it.value === value));
  const selected = items[selectedIndex];

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef<{ buffer: string; timer: number | null }>({ buffer: "", timer: null });

  const openList = (active = selectedIndex) => {
    setActiveIndex(active);
    setOpen(true);
  };
  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  };
  const choose = (index: number) => {
    onChange(items[index].value);
    close();
  };

  // Close when clicking outside the control.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const typeaheadMatch = (char: string) => {
    const t = typeahead.current;
    t.buffer += char.toLowerCase();
    if (t.timer) window.clearTimeout(t.timer);
    t.timer = window.setTimeout(() => (t.buffer = ""), 600);
    // Search after the current item first, then wrap around to the start.
    const from = open ? activeIndex : selectedIndex;
    const order = [...items.keys()].slice(from + 1).concat([...items.keys()].slice(0, from + 1));
    const found = order.find((i) => items[i].label.toLowerCase().startsWith(t.buffer));
    if (found == null) return;
    if (open) setActiveIndex(found);
    else openList(found);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList();
        else setActiveIndex((i) => Math.min(items.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openList();
        else setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          setActiveIndex(items.length - 1);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) choose(activeIndex);
        else openList();
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          close();
        }
        break;
      case "Tab":
        if (open) setOpen(false);
        break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          typeaheadMatch(e.key);
        }
    }
  };

  return (
    <div className="space-y-2" ref={rootRef}>
      <span id={labelId} className={hideLabel ? "sr-only" : "block text-xs text-sub"}>
        {label}
      </span>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={`${labelId} ${id}`}
          aria-activedescendant={open ? `${id}-opt-${activeIndex}` : undefined}
          onClick={() => (open ? close(false) : openList())}
          onKeyDown={onKeyDown}
          className={`flex w-full items-center justify-between gap-2 rounded-2xl border bg-surface py-3.5 px-4 text-left text-sm font-medium transition-[background-color,border-color] hover:bg-surface-2 ${
            open ? "border-accent" : "border-line hover:border-accent"
          } ${value ? "text-ink" : "text-sub"}`}
        >
          <span className="truncate">{selected.label}</span>
          <Icon
            name="chevron"
            size={18}
            className={`shrink-0 text-faint transition-transform duration-150 ${open ? "-rotate-90" : "rotate-90"}`}
          />
        </button>

        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            tabIndex={-1}
            className="scroll-themed reveal absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-xl shadow-black/30"
          >
            {items.map((it, i) => {
              const isSelected = i === selectedIndex;
              const isActive = i === activeIndex;
              return (
                <li
                  key={it.value ?? "__any"}
                  id={`${id}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(i)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    isActive ? "bg-surface-2" : ""
                  } ${isSelected ? "font-semibold text-accent" : "text-ink"}`}
                >
                  <span className="truncate">{it.label}</span>
                  {isSelected && <Icon name="check" size={16} className="shrink-0 text-accent" />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
