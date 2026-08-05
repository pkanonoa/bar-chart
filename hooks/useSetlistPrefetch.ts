/**
 * useSetlistPrefetch
 *
 * Pre-fetches the next few setlist items (charts AND lyrics) in the background
 * so navigating during a performance session feels instant.
 *
 * Works the same way as useChartPrefetch but is aware of item type so it can
 * call either readChart() or readLyrics() and also applies any per-item
 * transpose override before caching.
 */

import { useEffect, useRef, useCallback } from 'react';
import { readChart, readLyrics } from '@/lib/storage';
import { transposeChart } from '@/lib/transpose';
import { ChartData } from '@/lib/chart-types';
import { type SetlistItem } from '@/lib/setlists';

const LOOKAHEAD = 2;
const LOOKBEHIND = 1;
const DEBOUNCE_MS = 120;

interface CachedContent {
  chart?: ChartData;
  lyrics?: any;
}

type ContentCache = Map<string, CachedContent>;

export function useSetlistPrefetch(items: SetlistItem[], currentPosition: number) {
  const cacheRef = useRef<ContentCache>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable cache key per item (includes transpose so transposed version is cached)
  const cacheKey = (item: SetlistItem) =>
    `${item.item_id}::${item.transpose_override ?? 0}`;

  const prefetch = useCallback(() => {
    const cache = cacheRef.current;
    const inFlight = inFlightRef.current;

    const low = Math.max(0, currentPosition - LOOKBEHIND);
    const high = Math.min(items.length - 1, currentPosition + LOOKAHEAD);

    for (let i = low; i <= high; i++) {
      const item = items[i];
      if (!item) continue;
      const key = cacheKey(item);
      if (cache.has(key) || inFlight.has(key)) continue;

      inFlight.add(key);

      if (item.item_type === 'chart') {
        readChart(item.item_id).then((data) => {
          inFlight.delete(key);
          if (data) {
            let display = { ...data } as ChartData;
            const localOverride = typeof window !== 'undefined' ? localStorage.getItem(`perf_lines_${item.id}`) : null;
            if (localOverride) {
              try {
                display.lines = JSON.parse(localOverride);
                display.is_performance_copy = true;
              } catch (e) {}
            } else if (item.lines_override) {
              display.lines = item.lines_override;
              display.is_performance_copy = true;
            }
            if (item.transpose_override) {
              display = transposeChart(display, item.transpose_override, display.prefer_flats);
            }
            cache.set(key, { chart: display });
          }
        }).catch(() => inFlight.delete(key));
      } else {
        readLyrics(item.item_id).then((data) => {
          inFlight.delete(key);
          if (data) cache.set(key, { lyrics: data });
        }).catch(() => inFlight.delete(key));
      }
    }

    // Evict entries outside a generous window
    const keepStart = Math.max(0, currentPosition - LOOKBEHIND - 2);
    const keepEnd = Math.min(items.length - 1, currentPosition + LOOKAHEAD + 2);
    const keepKeys = new Set(items.slice(keepStart, keepEnd + 1).map(cacheKey));
    for (const k of cache.keys()) {
      if (!keepKeys.has(k)) cache.delete(k);
    }
  }, [items, currentPosition]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(prefetch, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [prefetch]);

  /** Try cache before network. Returns null if not yet prefetched. */
  const getFromCache = useCallback((item: SetlistItem): CachedContent | null => {
    return cacheRef.current.get(cacheKey(item)) ?? null;
  }, []);

  /** Store a freshly fetched item so it's available on back navigation. */
  const addToCache = useCallback((item: SetlistItem, content: CachedContent) => {
    cacheRef.current.set(cacheKey(item), content);
  }, []);

  return { getFromCache, addToCache };
}
