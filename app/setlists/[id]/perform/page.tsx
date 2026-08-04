'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { listSetlistItems, type SetlistItem } from '@/lib/setlists';
import { readChart, readLyrics } from '@/lib/storage';
import { transposeChart } from '@/lib/transpose';
import { ChartRenderer } from '@/components/ChartRenderer';
import { ChartData } from '@/lib/chart-types';
import { supabase } from '@/lib/supabase';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import {
  X, ChevronLeft, ChevronRight, Users, Radio, RefreshCw,
} from 'lucide-react';

// ─── Setlist Performance Session Hook ─────────────────────────────────────────

type PerfMode = 'leader' | 'follower' | 'loading';

interface SetlistPresence {
  role: 'leader' | 'follower';
  name: string;
  songPosition: number;
}

function useSetlistSession(setlistId: string, isLeaderDevice: boolean) {
  const [mode, setMode] = useState<PerfMode>('loading');
  const [songPosition, setSongPosition] = useState(0);
  const [leaderName, setLeaderName] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(true);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myNameRef = useRef('Anonymous');
  const isMountedRef = useRef(true);
  const positionRef = useRef(0);
  const isFollowingRef = useRef(true);

  useEffect(() => { positionRef.current = songPosition; }, [songPosition]);
  useEffect(() => { isFollowingRef.current = isFollowing; }, [isFollowing]);

  useEffect(() => {
    isMountedRef.current = true;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMountedRef.current) return;
      if (user) {
        myNameRef.current = user.email?.split('@')[0] ?? 'Anonymous';
      }

      const channel = supabase.channel(`setlist-${setlistId}`);
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'song-change' }, ({ payload }) => {
          if (!isMountedRef.current) return;
          const pos = payload?.position ?? 0;
          setSongPosition(pos);
          positionRef.current = pos;
          if (isFollowingRef.current) {
            window.dispatchEvent(new CustomEvent('setlist-navigate', { detail: { position: pos } }));
          }
        })
        .on('broadcast', { event: 'session-end' }, () => {
          if (!isMountedRef.current) return;
          window.dispatchEvent(new CustomEvent('setlist-session-end'));
        })
        .on('presence', { event: 'sync' }, () => {
          if (!isMountedRef.current) return;
          const state = channel.presenceState<SetlistPresence>();
          const presences = Object.values(state).flat() as SetlistPresence[];
          const leader = presences.find(p => p.role === 'leader');
          setLeaderName(leader?.name ?? null);
          if (!isLeaderDevice && leader) {
            setSongPosition(leader.songPosition ?? 0);
            positionRef.current = leader.songPosition ?? 0;
            setMode('follower');
          }
          setFollowerCount(presences.filter(p => p.role === 'follower').length);
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED' || !isMountedRef.current) return;
          if (isLeaderDevice) {
            await channel.track({ role: 'leader', name: myNameRef.current, songPosition: 0 });
            setMode('leader');
          } else {
            await channel.track({ role: 'follower', name: myNameRef.current, songPosition: 0 });
          }
        });
    };

    init();
    return () => {
      isMountedRef.current = false;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [setlistId, isLeaderDevice]);

  const goTo = useCallback((pos: number) => {
    const ch = channelRef.current;
    if (!ch) return;
    setSongPosition(pos);
    positionRef.current = pos;
    ch.track({ role: 'leader', name: myNameRef.current, songPosition: pos });
    ch.send({ type: 'broadcast', event: 'song-change', payload: { position: pos } });
  }, []);

  const endSession = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: 'broadcast', event: 'session-end', payload: {} });
    supabase.removeChannel(ch);
    channelRef.current = null;
  }, []);

  const stopFollowing = useCallback(() => {
    setIsFollowing(false);
    isFollowingRef.current = false;
  }, []);

  const resumeFollowing = useCallback(() => {
    setIsFollowing(true);
    isFollowingRef.current = true;
    window.dispatchEvent(new CustomEvent('setlist-navigate', { detail: { position: positionRef.current } }));
  }, []);

  return { mode, songPosition, leaderName, followerCount, isFollowing, goTo, endSession, stopFollowing, resumeFollowing };
}

// ─── Inner chart wrapper (zoom) ───────────────────────────────────────────────

function ChartWrapper({ chart }: { chart: ChartData }) {
  const { zoomToElement } = useControls();
  useEffect(() => {
    let id: any;
    const fit = () => {
      clearTimeout(id);
      id = setTimeout(() => zoomToElement('setlist-chart-card', undefined, 0), 150);
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => { clearTimeout(id); window.removeEventListener('resize', fit); window.removeEventListener('orientationchange', fit); };
  }, [zoomToElement]);

  useEffect(() => {
    const handler = () => zoomToElement('setlist-chart-card', undefined, 250);
    window.addEventListener('setlist-navigate', handler);
    return () => window.removeEventListener('setlist-navigate', handler);
  }, [zoomToElement]);

  return <ChartRenderer chart={chart} id="setlist-chart-card" />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SetlistPerformPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const setlistId = params.id as string;

  const [items, setItems] = useState<SetlistItem[]>([]);
  const [setlistName, setSetlistName] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const headerTimerRef = useRef<any>(null);

  // Current song content
  const [currentChart, setCurrentChart] = useState<ChartData | null>(null);
  const [currentLyrics, setCurrentLyrics] = useState<any | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  // Font
  const [selectedFont, setSelectedFont] = useState('system');
  useEffect(() => {
    const f = localStorage.getItem('chord-grid-font');
    if (f) setSelectedFont(f);
  }, []);

  // Determine leader vs follower
  const isLeaderDevice = typeof window !== 'undefined'
    ? !!sessionStorage.getItem(`setlist-leader-${setlistId}`)
    : false;

  const {
    mode, songPosition, leaderName, followerCount,
    isFollowing, goTo, endSession, stopFollowing, resumeFollowing,
  } = useSetlistSession(setlistId, isLeaderDevice);

  const isLeader = mode === 'leader';

  // Load items
  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      setLoading(true);
      const { supabase: sb } = await import('@/lib/supabase');
      const { data: sl } = await sb.from('setlists').select('name').eq('id', setlistId).single();
      if (sl) setSetlistName(sl.name);
      const loaded = await listSetlistItems(setlistId);
      setItems(loaded);
      setLoading(false);
    })();
  }, [authLoading, user, setlistId]);

  // Load current song content
  const loadSongAt = useCallback(async (pos: number, force = false) => {
    const item = items[pos];
    if (!item) return;
    setContentLoading(true);
    setCurrentChart(null);
    setCurrentLyrics(null);
    if (item.item_type === 'chart') {
      const chart = await readChart(item.item_id, force);
      if (chart) {
        let display = chart as ChartData;
        if (item.transpose_override) {
          display = transposeChart(display, item.transpose_override, display.prefer_flats);
        }
        setCurrentChart(display);
      }
    } else {
      const lyr = await readLyrics(item.item_id);
      setCurrentLyrics(lyr);
    }
    setContentLoading(false);
  }, [items]);

  useEffect(() => { if (items.length > 0) loadSongAt(songPosition); }, [songPosition, items, loadSongAt]);

  // Header auto-hide
  const bumpHeader = useCallback(() => {
    setShowHeader(true);
    clearTimeout(headerTimerRef.current);
    headerTimerRef.current = setTimeout(() => setShowHeader(false), 4000);
  }, []);

  useEffect(() => { bumpHeader(); return () => clearTimeout(headerTimerRef.current); }, [bumpHeader]);

  // Session end handler
  useEffect(() => {
    const handler = () => setSessionEnded(true);
    window.addEventListener('setlist-session-end', handler);
    return () => window.removeEventListener('setlist-session-end', handler);
  }, []);

  // Keyboard nav (leader)
  useEffect(() => {
    if (!isLeader) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(Math.min(songPosition + 1, items.length - 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(Math.max(songPosition - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isLeader, songPosition, items.length, goTo]);

  const handleEndSession = () => {
    endSession();
    sessionStorage.removeItem(`setlist-leader-${setlistId}`);
    router.push(`/setlists/${setlistId}`);
  };

  const currentItem = items[songPosition];

  if (sessionEnded) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-text-primary gap-4">
        <Radio size={40} className="text-accent-start opacity-50" />
        <h2 className="text-2xl font-bold">Session ended</h2>
        <button
          onClick={() => router.push(`/setlists/${setlistId}`)}
          className="px-6 py-3 bg-accent-gradient text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all"
        >
          Back to Setlist
        </button>
      </div>
    );
  }

  if (loading || mode === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-text-primary gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-accent-start border-t-transparent animate-spin" />
        <p className="text-sm text-text-secondary">
          {mode === 'loading' && !isLeaderDevice ? 'Waiting for leader to join…' : 'Loading…'}
        </p>
        <button onClick={() => router.push(`/setlists/${setlistId}`)} className="text-xs text-text-secondary underline mt-2">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-bg flex flex-col text-text-primary relative overflow-hidden"
      onClick={bumpHeader}
    >
      {/* Auto-hiding header */}
      <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-bg/80 backdrop-blur-md border-b border-border/50 transition-all duration-300 ${showHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={e => { e.stopPropagation(); isLeader ? handleEndSession() : router.push(`/setlists/${setlistId}`); }}
            className="p-2 text-text-secondary hover:text-white bg-surface border border-border rounded-lg transition-all shrink-0"
          >
            <X size={18} />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-bold text-text-primary truncate">{setlistName}</p>
            <p className="text-[10px] text-text-secondary">
              {isLeader
                ? <span className="flex items-center gap-1"><Users size={10} /> {followerCount} follower{followerCount !== 1 ? 's' : ''}</span>
                : <span>Following {leaderName}</span>
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Song counter */}
          <div className="px-3 py-1.5 bg-surface border border-border rounded-xl text-xs font-bold text-text-secondary">
            Song {songPosition + 1} of {items.length}
            {currentItem && <span className="text-text-primary ml-1">· {currentItem.title}</span>}
          </div>

          {/* Follower refresh */}
          {!isLeader && (
            <button
              onClick={e => { e.stopPropagation(); loadSongAt(songPosition, true); }}
              className="p-2 text-text-secondary hover:text-white bg-surface border border-border rounded-lg transition-all"
              title="Refresh current song"
            >
              <RefreshCw size={16} className={contentLoading ? 'animate-spin' : ''} />
            </button>
          )}

          {/* Transpose label */}
          {currentItem?.transpose_override !== null && currentItem?.transpose_override !== undefined && currentItem.item_type === 'chart' && (
            <span className="text-[10px] font-bold px-2 py-1 bg-accent-gradient/15 text-accent-start border border-accent-solid/20 rounded-lg">
              Setlist: {currentItem.transpose_override > 0 ? '+' : ''}{currentItem.transpose_override}
            </span>
          )}

          {isLeader && (
            <button
              onClick={e => { e.stopPropagation(); handleEndSession(); }}
              className="px-3 py-1.5 text-xs font-bold text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg hover:bg-red-500 hover:text-white transition-all"
            >
              End
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 w-full">
        {contentLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-8 h-8 rounded-full border-2 border-accent-start border-t-transparent animate-spin" />
          </div>
        )}

        {currentItem?.item_type === 'chart' && currentChart && (
          <TransformWrapper
            initialScale={1}
            minScale={0.2}
            maxScale={4}
            centerOnInit
            doubleClick={{ disabled: false }}
          >
            <TransformComponent
              wrapperStyle={{ width: '100vw', height: '100vh' }}
              contentStyle={{ padding: '80px 24px 120px' }}
            >
              <ChartWrapper chart={currentChart} />
            </TransformComponent>
          </TransformWrapper>
        )}

        {currentItem?.item_type === 'lyrics' && currentLyrics && (
          <div className="pt-20 pb-32 px-6 max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-text-primary">{currentLyrics.title}</h1>
            {currentItem.notes && (
              <p className="text-sm italic text-text-secondary mb-4">{currentItem.notes}</p>
            )}
            <pre
              className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-text-primary"
              style={selectedFont !== 'system' ? { fontFamily: selectedFont } : {}}
            >
              {currentLyrics.body}
            </pre>
          </div>
        )}
      </div>

      {/* Leader navigation */}
      {isLeader && (
        <>
          <button
            onClick={e => { e.stopPropagation(); goTo(Math.max(0, songPosition - 1)); }}
            disabled={songPosition === 0}
            className="fixed bottom-8 left-5 z-50 w-16 h-16 flex items-center justify-center text-white bg-accent-gradient rounded-2xl shadow-popover hover:brightness-110 transition-all disabled:opacity-30"
            title="Previous song (←)"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); goTo(Math.min(items.length - 1, songPosition + 1)); }}
            disabled={songPosition >= items.length - 1}
            className="fixed bottom-8 right-5 z-50 w-16 h-16 flex items-center justify-center text-white bg-accent-gradient rounded-2xl shadow-popover hover:brightness-110 transition-all disabled:opacity-30"
            title="Next song (→)"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}

      {/* Follower: not following indicator + back-to-leader */}
      {!isLeader && !isFollowing && (
        <button
          onClick={e => { e.stopPropagation(); resumeFollowing(); }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-widest uppercase text-white bg-accent-gradient rounded-full shadow-popover hover:brightness-110 transition-all animate-bounce"
        >
          <Radio size={14} /> Back to {leaderName}'s song
        </button>
      )}
    </div>
  );
}
