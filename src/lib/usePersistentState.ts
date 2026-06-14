import { useEffect, useRef, useState } from "react";

/**
 * Like useState, but reads/writes the value to localStorage under `key`.
 * Loads after mount (avoids SSR hydration mismatch) and skips the first write
 * so the stored value is never clobbered by the initial default.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const skipFirstWrite = useRef(true);

  useEffect(() => {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) {
      try {
        setValue(JSON.parse(raw) as T);
      } catch {
        /* ignore corrupt values */
      }
    }
  }, [key]);

  useEffect(() => {
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
