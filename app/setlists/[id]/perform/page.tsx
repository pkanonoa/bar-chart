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
  X, ChevronLeft, ChevronRight, Users, Radio, RefreshCw, FileText, Music,
} from 'lucide-react';

// ─── Setlist Session Hook ─────────────────────────────────────────────────────

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
  // Stable ref so the effect dependency array never changes
  const isLeaderRef = useRef(isLeaderDevice);

  useEffect(() => { positionRef.current = songPosition; }, [songPosition]);
  useEffect(() => { isFollowingRef.current = isFollowing; }, [isFollowing]);

  useEffect(() => {
    isMountedRef.current = true;
    const isLdr = isLeaderRef.current;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMountedRef.current) return;
      if (user) myNameRef.current = user.email?.split('@')[0] ?? 'Anonymous';

      const channel = supabase.channel(`setlist-${setlistId}`);
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'song-change' }, ({ payload }) => {
          if (!isMountedRef.current) return;
          const pos = payload?.position ?? 0;
          setSongPosition(pos);
          positionRef.current = pos;
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
          if (!isLdr && leader) {
            setSongPosition(leader.songPosition ?? 0);
            positionRef.current = leader.songPosition ?? 0;
            setMode('follower');
          }
          setFollowerCount(presences.filter(p => p.role === 'follower').length);
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED' || !isMountedRef.current) return;
          if (isLdr) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setlistId]); // intentionally omit isLeaderDevice — captured via ref on mount

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

  const stopFollowing = useCallback(() => { setIsFollowing(false); isFollowingRef.current = false; }, []);
  const resumeFollowing = useCallback(() => {
    setIsFollowing(true);
    isFollowingRef.current = true;
    setSongPosition(positionRef.current);
  }, []);

  return { mode, songPosition, leaderName, followerCount, isFollowing, goTo, endSession, stopFollowing, resumeFollowing };
}

// ─── Chart zoom wrapper ───────────────────────────────────────────────────────

function ChartWrapper({ chart, songKey }: { chart: ChartData; songKey: string }) {
  const { zoomToElement } = useControls();
  useEffect(() => {
    let id: any;
    const fit = () => { clearTimeout(id); id = setTimeout(() => zoomToElement('perf-chart-card', undefined, 0), 100); };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => { clearTimeout(id); window.removeEventListener('resize', fit); window.removeEventListener('orientationchange', fit); };
  }, [zoomToElement, songKey]);

  return <ChartRenderer chart={chart} id="perf-chart-card" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SetlistPerformPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const setlistId = params.id as string;

  const [items, setItems] = useState<SetlistItem[]>([]);
  const [setlistName, setSetlistName] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);

  const [currentChart, setCurrentChart] = useState<ChartData | null>(null);
  const [currentLyrics, setCurrentLyrics] = useState<any | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [barsVisible, setBarsVisible] = useState(false);

  const [selectedFont, setSelectedFont] = useState('system');
  useEffect(() => { const f = localStorage.getItem('chord-grid-font'); if (f) setSelectedFont(f); }, []);

  const isLeaderDevice = typeof window !== 'undefined'
    ? !!sessionStorage.getItem(`setlist-leader-${setlistId}`)
    : false;

  const { mode, songPosition, leaderName, followerCount, isFollowing, goTo, endSession, stopFollowing, resumeFollowing } =
    useSetlistSession(setlistId, isLeaderDevice);

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

  // Load song content when position changes
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
        if (item.transpose_override) display = transposeChart(display, item.transpose_override, display.prefer_flats);
        setCurrentChart(display);
      }
    } else {
      const lyr = await readLyrics(item.item_id);
      setCurrentLyrics(lyr);
    }
    setContentLoading(false);
  }, [items]);

  useEffect(() => { if (items.length > 0) loadSongAt(songPosition); }, [songPosition, items, loadSongAt]);

  // Scroll active tab into view when bars are visible
  useEffect(() => {
    if (barsVisible && activeTabRef.current && tabsRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [songPosition, barsVisible]);

  // Session end
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
      if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   goTo(Math.max(songPosition - 1, 0));
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

  // ── Special screens ───────────────────────────────────────────────────────

  if (sessionEnded) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-text-primary gap-4">
        <Radio size={40} className="text-accent-start opacity-50" />
        <h2 className="text-2xl font-bold">Session ended</h2>
        <button onClick={() => router.push(`/setlists/${setlistId}`)} className="px-6 py-3 bg-accent-gradient text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all">
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
        <button onClick={() => router.push(`/setlists/${setlistId}`)} className="text-xs text-text-secondary underline mt-2">Cancel</button>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg flex flex-col text-text-primary">

      {/* ── Fixed top bar — slides in from top ──────────────────────────── */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex flex-col bg-surface/90 backdrop-blur-xl border-b border-border"
        style={{
          transform: barsVisible ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Row 1: setlist name + controls */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            onClick={() => isLeader ? handleEndSession() : router.push(`/setlists/${setlistId}`)}
            className="p-2 text-text-secondary hover:text-white bg-surface-raised border border-border rounded-lg transition-all shrink-0"
          >
            <X size={16} />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-text-primary truncate">{setlistName}</p>
            <p className="text-[10px] text-text-secondary">
              {isLeader
                ? `${followerCount} follower${followerCount !== 1 ? 's' : ''}`
                : `Following ${leaderName}`
              }
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Transpose badge */}
            {currentItem?.transpose_override !== null && currentItem?.transpose_override !== undefined && currentItem.item_type === 'chart' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent-gradient/15 text-accent-start border border-accent-solid/20">
                {currentItem.transpose_override > 0 ? '+' : ''}{currentItem.transpose_override}
              </span>
            )}
            {/* Follower refresh */}
            {!isLeader && (
              <button
                onClick={() => loadSongAt(songPosition, true)}
                className="p-1.5 text-text-secondary hover:text-white bg-surface-raised border border-border rounded-lg transition-all"
              >
                <RefreshCw size={14} className={contentLoading ? 'animate-spin' : ''} />
              </button>
            )}
            {/* Follower: stop following */}
            {!isLeader && isFollowing && (
              <button onClick={stopFollowing} className="px-2 py-1 text-[9px] font-bold text-text-secondary border border-border rounded-lg hover:text-white transition-all">
                Browse
              </button>
            )}
            {/* End session (leader) */}
            {isLeader && (
              <button onClick={handleEndSession} className="px-2 py-1 text-[9px] font-bold text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg hover:bg-red-500 hover:text-white transition-all">
                End
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Song tabs */}
        <div
          ref={tabsRef}
          className="flex items-end overflow-x-auto gap-1 px-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, idx) => {
            const active = idx === songPosition;
            const Icon = item.item_type === 'chart' ? FileText : Music;
            const canClick = isLeader || !isFollowing;

            return (
              <button
                key={item.id}
                ref={active ? activeTabRef : undefined}
                disabled={!canClick}
                onClick={() => {
                  if (isLeader) goTo(idx);
                  else { stopFollowing(); }
                  setBarsVisible(false);
                }}
                className={`
                  relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold
                  rounded-t-xl border border-b-0 transition-all duration-150
                  whitespace-nowrap shrink-0 max-w-[150px]
                  ${active
                    ? 'bg-bg border-border text-text-primary shadow-[0_-2px_10px_rgba(0,0,0,0.4)] z-10 -mb-px pb-[calc(0.5rem+1px)]'
                    : canClick
                      ? 'bg-surface/40 border-transparent text-text-secondary hover:text-text-primary hover:bg-surface/80 cursor-pointer'
                      : 'bg-surface/20 border-transparent text-text-secondary/50 cursor-default'
                  }
                `}
              >
                {active && <span className="absolute top-0 left-2 right-2 h-[2px] rounded-full bg-accent-gradient" />}
                <span className="text-[9px] font-black opacity-40 shrink-0">{idx + 1}</span>
                <Icon size={11} className={active ? 'text-accent-start shrink-0' : 'shrink-0'} />
                <span className="truncate">{item.title || 'Untitled'}</span>
                {item.transpose_override !== null && item.transpose_override !== undefined && item.item_type === 'chart' && (
                  <span className="text-[8px] font-black px-0.5 rounded bg-accent-gradient/20 text-accent-start shrink-0">
                    {item.transpose_override > 0 ? '+' : ''}{item.transpose_override}
                  </span>
                )}
              </button>
            );
          })}
          <div className="w-2 shrink-0" />
        </div>
      </div>

      {/* ── Content area — full screen, tap to toggle bars ───────────────── */}
      <div
        className="flex-1 pt-0 w-full h-screen"
        onClick={() => setBarsVisible(v => !v)}
      >
        {contentLoading && (
          <div className="flex items-center justify-center h-[50vh]">
            <div className="w-8 h-8 rounded-full border-2 border-accent-start border-t-transparent animate-spin" />
          </div>
        )}

        {!contentLoading && currentItem?.item_type === 'chart' && currentChart && (
          <TransformWrapper
            key={`chart-${songPosition}`}
            initialScale={1} minScale={0.2} maxScale={4}
            centerOnInit
            doubleClick={{ disabled: false }}
          >
            <TransformComponent
              wrapperStyle={{ width: '100vw', height: '100dvh' }}
              contentStyle={{ padding: '32px 24px 100px' }}
            >
              <ChartWrapper chart={currentChart} songKey={`${songPosition}`} />
            </TransformComponent>
          </TransformWrapper>
        )}

        {!contentLoading && currentItem?.item_type === 'lyrics' && currentLyrics && (
          <div className="px-6 py-8 pb-28 max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-text-primary">{currentLyrics.title}</h1>
            {currentItem.notes && <p className="text-sm italic text-text-secondary mb-4">{currentItem.notes}</p>}
            <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-text-primary"
              style={selectedFont !== 'system' ? { fontFamily: selectedFont } : {}}
            >{currentLyrics.body}</pre>
          </div>
        )}
      </div>

      {/* ── Leader prev / next ────────────────────────────────────────────── */}
      {isLeader && (
        <>
          <button
            onClick={() => goTo(Math.max(0, songPosition - 1))}
            disabled={songPosition === 0}
            className="fixed bottom-8 left-5 z-50 w-16 h-16 flex items-center justify-center text-white bg-accent-gradient rounded-2xl shadow-popover hover:brightness-110 disabled:opacity-30 transition-all"
            title="Previous (←)"
          ><ChevronLeft size={32} /></button>
          <button
            onClick={() => goTo(Math.min(items.length - 1, songPosition + 1))}
            disabled={songPosition >= items.length - 1}
            className="fixed bottom-8 right-5 z-50 w-16 h-16 flex items-center justify-center text-white bg-accent-gradient rounded-2xl shadow-popover hover:brightness-110 disabled:opacity-30 transition-all"
            title="Next (→)"
          ><ChevronRight size={32} /></button>
        </>
      )}

      {/* ── Follower: back to leader ──────────────────────────────────────── */}
      {!isLeader && !isFollowing && (
        <button
          onClick={resumeFollowing}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-widest uppercase text-white bg-accent-gradient rounded-full shadow-popover hover:brightness-110 animate-bounce transition-all"
        >
          <Radio size={14} /> Back to {leaderName}'s song
        </button>
      )}
    </div>
  );
}
