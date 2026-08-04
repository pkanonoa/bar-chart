/**
 * useChartPrefetch
 *
 * Pre-fetches the next `lookahead` charts in the background so that tapping
 * Next during a performance session shows the chart instantly.
 *
 * Strategy
 * --------
 * - A Map<id, ChartData> acts as the in-memory cache.
 * - Whenever `currentIndex` changes we queue the next `lookahead` IDs that
 *   are not already cached.  We also keep the previous chart to handle quick
 *   back-taps.
 * - Fetches are debounced slightly so rapid navigation doesn't flood the
 *   network.
 * - The hook exposes `getFromCache(id)` so the caller can attempt a cache
 *   hit before triggering a real network fetch.
 */

import { useEffect, useRef, useCallback } from 'react';
import { readChart } from '@/lib/storage';
import { ChartData } from '@/lib/chart-types';

const LOOKAHEAD = 2; // how many charts ahead to pre-fetch
const LOOKBEHIND = 1; // how many charts behind to keep cached
const DEBOUNCE_MS = 120; // wait before kicking off background fetches

type Cache = Map<string, ChartData>;

export function useChartPrefetch(chartIds: string[], currentIndex: number) {
  const cacheRef = useRef<Cache>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetch = useCallback(() => {
    const cache = cacheRef.current;
    const inFlight = inFlightRef.current;

    // Determine which indices we want cached
    const low = Math.max(0, currentIndex - LOOKBEHIND);
    const high = Math.min(chartIds.length - 1, currentIndex + LOOKAHEAD);

    for (let i = low; i <= high; i++) {
      const id = chartIds[i];
      if (!id || cache.has(id) || inFlight.has(id)) continue;

      inFlight.add(id);
      readChart(id).then((data) => {
        inFlight.delete(id);
        if (data) {
          cache.set(id, data as ChartData);
        }
      }).catch(() => {
        inFlight.delete(id);
      });
    }

    // Evict entries that are far outside the window to keep memory bounded
    const keepStart = Math.max(0, currentIndex - LOOKBEHIND - 2);
    const keepEnd = Math.min(chartIds.length - 1, currentIndex + LOOKAHEAD + 2);
    const keepSet = new Set(chartIds.slice(keepStart, keepEnd + 1));
    for (const key of cache.keys()) {
      if (!keepSet.has(key)) cache.delete(key);
    }
  }, [chartIds, currentIndex]);

  useEffect(() => {
    // Debounce so rapid swipes don't fire a storm of fetches
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(prefetch, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [prefetch]);

  /**
   * Returns a cached chart immediately, or null if it hasn't been fetched yet.
   * The caller should fall back to `readChart()` on a null result.
   */
  const getFromCache = useCallback((id: string): ChartData | null => {
    return cacheRef.current.get(id) ?? null;
  }, []);

  /** Imperatively store a chart that was just fetched by the main loader. */
  const addToCache = useCallback((id: string, data: ChartData) => {
    cacheRef.current.set(id, data);
  }, []);

  return { getFromCache, addToCache };
}
