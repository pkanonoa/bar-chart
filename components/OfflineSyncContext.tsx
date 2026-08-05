'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { supabase } from '@/lib/supabase';
import {
  syncAllOffline,
  cacheChart,
  cacheLyric,
  cacheFolder,
  deleteFromCache,
  Chart,
  Folder,
} from '@/lib/storage';

// ─── Constants ─────────────────────────────────────────────────────────────

const AUTO_SYNC_KEY = 'chord-grid-auto-sync';
const LAST_SYNCED_KEY = 'chord-grid-last-synced-at';

// ─── Context Shape ──────────────────────────────────────────────────────────

interface OfflineSyncContextValue {
  /** Whether background auto-sync is enabled */
  autoSync: boolean;
  /** Toggle auto-sync on/off */
  setAutoSync: (value: boolean) => void;
  /** Whether a sync (manual or automatic) is in progress */
  isSyncing: boolean;
  /** Last sync result message, null if none */
  syncResult: string | null;
  /** ISO string of last successful sync, null if never synced */
  lastSyncedAt: string | null;
  /** Imperatively trigger a full sync. Pass isManual=true for button clicks */
  triggerSync: (isManual?: boolean) => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue>({
  autoSync: true,
  setAutoSync: () => {},
  isSyncing: false,
  syncResult: null,
  lastSyncedAt: null,
  triggerSync: async () => {},
});

// ─── Provider ───────────────────────────────────────────────────────────────

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [autoSync, setAutoSyncState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(AUTO_SYNC_KEY);
    // null means first-time user → default ON
    return stored === null ? true : stored === 'true';
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LAST_SYNCED_KEY);
  });

  // Keep a ref to the autoSync value so async/closure callbacks see the latest
  const autoSyncRef = useRef(autoSync);
  autoSyncRef.current = autoSync;

  // Track whether initial sync has already been triggered this session
  const initialSyncDone = useRef(false);

  // Holds the active Supabase realtime channel so we can clean it up
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Core sync function ─────────────────────────────────────────────────

  const triggerSync = useCallback(async (isManual = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncAllOffline();
      const ts = new Date().toISOString();
      const msg = `All songs synced — ${res.chartsCount} charts, ${res.lyricsCount} lyrics, ${res.foldersCount} folders`;
      setSyncResult(msg);
      setLastSyncedAt(ts);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_SYNCED_KEY, ts);
      }
    } catch {
      setSyncResult('Sync failed — check your connection and try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // ── autoSync persistence ───────────────────────────────────────────────

  const setAutoSync = useCallback((value: boolean) => {
    setAutoSyncState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTO_SYNC_KEY, String(value));
    }
  }, []);

  // ── Live realtime subscription ─────────────────────────────────────────

  const subscribeToRealtime = useCallback(() => {
    // Clean up any existing subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel('offline-sync-realtime')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'charts' },
        (payload: any) => {
          if (!autoSyncRef.current) return;
          if (payload.eventType === 'DELETE') {
            deleteFromCache(payload.old.id, 'charts');
          } else if (payload.new) {
            cacheChart(payload.new as Chart);
          }
        }
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'lyrics' },
        (payload: any) => {
          if (!autoSyncRef.current) return;
          if (payload.eventType === 'DELETE') {
            deleteFromCache(payload.old.id, 'lyrics');
          } else if (payload.new) {
            cacheLyric(payload.new);
          }
        }
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'folders' },
        (payload: any) => {
          if (!autoSyncRef.current) return;
          if (payload.eventType === 'DELETE') {
            deleteFromCache(payload.old.id, 'folders');
          } else if (payload.new) {
            cacheFolder(payload.new as Folder);
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  }, []);

  const unsubscribeFromRealtime = useCallback(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  }, []);

  // ── React to autoSync toggle ───────────────────────────────────────────

  useEffect(() => {
    if (autoSync) {
      subscribeToRealtime();
    } else {
      unsubscribeFromRealtime();
    }

    return () => {
      // Cleanup when component unmounts — channel cleanup handled above
    };
  }, [autoSync, subscribeToRealtime, unsubscribeFromRealtime]);

  // ── Initial full sync on mount (when user is logged in) ───────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Wait for auth to be available, then run initial sync once
    const runInitialSync = async () => {
      if (initialSyncDone.current) return;
      if (!autoSyncRef.current) return;

      // Check there's an actual session (not guest)
      const isGuest = localStorage.getItem('chord-grid-guest-mode') === 'true';
      if (isGuest) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
      } catch {
        return;
      }

      initialSyncDone.current = true;
      // Fire and forget — don't block UI
      triggerSync(false).catch(() => {});
    };

    // Small delay to let AuthProvider resolve first
    const timer = setTimeout(runInitialSync, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Catch-up sync on reconnect ────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      if (!autoSyncRef.current) return;
      // Slight delay so the pending_saves flush in storage.ts can run first
      setTimeout(() => {
        triggerSync(false).catch(() => {});
      }, 1500);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [triggerSync]);

  // ── Clear sync result after a display timeout ─────────────────────────

  useEffect(() => {
    if (!syncResult) return;
    const timer = setTimeout(() => setSyncResult(null), 8000);
    return () => clearTimeout(timer);
  }, [syncResult]);

  return (
    <OfflineSyncContext.Provider
      value={{ autoSync, setAutoSync, isSyncing, syncResult, lastSyncedAt, triggerSync }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export const useOfflineSync = () => useContext(OfflineSyncContext);
