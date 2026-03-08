/**
 * useInterval.ts — safe setInterval that clears on unmount (no memory leaks)
 */
import { useEffect, useRef } from "react";

export function useInterval(callback: () => void, delayMs: number | null) {
  const saved = useRef(callback);

  // Always keep ref current without restarting the interval
  useEffect(() => { saved.current = callback; }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => saved.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
