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
  /** Show a filter box in the popup. Defaults to on for longer lists. */
  searchable?: boolean;
}

type Item<T extends string> = { value: T | null; label: string };

/**
 * Accessible custom-listbox dropdown. A custom popup is used instead of a native
 * `<select>` so the option list and its scrollbar can be themed to match the UI —
 * native option popups aren't styleable across browsers. Longer lists get a filter
 * box (WAI-ARIA editable-combobox pattern); short ones stay a select-only combobox
 * with type-ahead. Full keyboard support throughout (arrows, Enter, Escape, Tab).
 * The empty option maps to `null` so callers get a clean "any" value.
 */
export function Select<T extends string>({
  label,
  hideLabel,
  value,
  onChange,
  options,
  placeholder = "Any",
  searchable,
}: SelectProps<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const labelId = `${id}-label`;
  const canSearch = searchable ?? options.length > 7;

  // The "any" choice is the first item. The visible list is filtered by the query.
  const items: Item<T>[] = [{ value: null, label: placeholder }, ...options];
  const selectedItemIndex = Math.max(0, items.findIndex((it) => it.value === value));
  const selected = items[selectedItemIndex];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(selectedItemIndex);

  const q = query.trim().toLowerCase();
  const filtered = canSearch && q ? items.filter((it) => it.label.toLowerCase().includes(q)) : items;
  const activeOptionId = filtered.length ? `${id}-opt-${activeIndex}` : undefined;

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef<{ buffer: string; timer: number | null }>({ buffer: "", timer: null });

  const openList = (active = selectedItemIndex) => {
    setQuery("");
    setActiveIndex(active);
    setOpen(true);
  };
  const close = (focusButton = true) => {
    setOpen(false);
    setQuery("");
    if (focusButton) buttonRef.current?.focus();
  };
  const choose = (filteredIndex: number) => {
    const it = filtered[filteredIndex];
    if (!it) return;
    onChange(it.value);
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

  // Move focus to the filter box when a searchable popup opens.
  useEffect(() => {
    if (open && canSearch) inputRef.current?.focus();
  }, [open, canSearch]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  // Type-ahead for the non-searchable (select-only) variant: jump to a matching option.
  const typeaheadMatch = (char: string) => {
    const t = typeahead.current;
    t.buffer += char.toLowerCase();
    if (t.timer) window.clearTimeout(t.timer);
    t.timer = window.setTimeout(() => (t.buffer = ""), 600);
    const from = open ? activeIndex : selectedItemIndex;
    const order = [...items.keys()].slice(from + 1).concat([...items.keys()].slice(0, from + 1));
    const found = order.find((i) => items[i].label.toLowerCase().startsWith(t.buffer));
    if (found == null) return;
    if (open) setActiveIndex(found);
    else openList(found);
  };

  const move = (delta: number) => setActiveIndex((i) => Math.min(filtered.length - 1, Math.max(0, i + delta)));

  // Keyboard on the trigger button.
  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (canSearch) {
      // The input drives navigation once open; the button only needs to open it.
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        if (!open) openList();
      } else if (e.key === "Escape") {
        if (open) close();
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Start typing → open and seed the filter with that character.
        e.preventDefault();
        setOpen(true);
        setQuery(e.key);
        setActiveIndex(0);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        open ? move(1) : openList();
        break;
      case "ArrowUp":
        e.preventDefault();
        open ? move(-1) : openList();
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
          setActiveIndex(filtered.length - 1);
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        open ? choose(activeIndex) : openList();
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

  // Keyboard on the filter box (searchable variant).
  const onInputKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Enter":
        e.preventDefault();
        choose(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        if (query) setQuery("");
        else close();
        break;
      case "Tab":
        setOpen(false);
        break;
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
          role={canSearch ? undefined : "combobox"}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={`${labelId} ${id}`}
          aria-activedescendant={!canSearch && open ? activeOptionId : undefined}
          onClick={() => (open ? close(false) : openList())}
          onKeyDown={onButtonKeyDown}
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
          <div className="reveal absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-xl shadow-black/30">
            {canSearch && (
              <div className="border-b border-line p-2">
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={activeOptionId}
                  aria-autocomplete="list"
                  aria-label={`Search ${label}`}
                  value={query}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={onInputKeyDown}
                  className="w-full rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:ring-1 focus:ring-accent"
                />
              </div>
            )}
            <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="scroll-themed max-h-60 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <li role="option" aria-selected={false} aria-disabled className="px-3 py-2.5 text-sm text-faint">
                  No matches
                </li>
              ) : (
                filtered.map((it, i) => {
                  const isSelected = it.value === value;
                  const isActive = i === activeIndex;
                  return (
                    <li
                      key={it.value ?? "__any"}
                      id={`${id}-opt-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(i)}
                      onMouseDown={(e) => e.preventDefault()} // keep input focus through the click
                      onClick={() => choose(i)}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        isActive ? "bg-surface-2" : ""
                      } ${isSelected ? "font-semibold text-accent" : "text-ink"}`}
                    >
                      <span className="truncate">{it.label}</span>
                      {isSelected && <Icon name="check" size={16} className="shrink-0 text-accent" />}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
