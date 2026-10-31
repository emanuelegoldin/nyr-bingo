import { useRef } from "react";

/**
 * Keeps the last value the server managed to load, so a failed read during a page
 * refresh does not blank data already on screen.
 *
 * @param value - The latest value, or undefined if its read failed.
 * @param fallback - Used until a value has loaded.
 * @returns The latest loaded value.
 */
export function useLastLoaded<T>(value: T | undefined, fallback: T): T {
  const lastLoaded = useRef<T>(fallback);
  if (value !== undefined) {
    lastLoaded.current = value;
  }
  return lastLoaded.current;
}
