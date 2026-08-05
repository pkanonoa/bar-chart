'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { listSetlistItems, updateSetlistItem, type SetlistItem } from '@/lib/setlists';
import { readChart, readLyrics } from '@/lib/storage';
import { transposeChart } from '@/lib/transpose';
import { ChartRenderer } from '@/components/ChartRenderer';
import { ChartData, Line, createDefaultLine } from '@/lib/chart-types';
import { supabase } from '@/lib/supabase';
import { useSetlistPrefetch } from '@/hooks/useSetlistPrefetch';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import {
  X, ChevronLeft, ChevronRight, Users, Radio, RefreshCw, FileText, Music,
  Pencil, Plus, Trash2, RotateCcw, Check, Zap, Save
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

      const instanceId = Math.random().toString(36).slice(2, 8);
      const channel = supabase.channel(`setlist-${setlistId}-${instanceId}`);
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
  }, [setlistId]);

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

  // Performance Chord Editing State
  const [perfModalOpen, setPerfModalOpen] = useState(false);
  const [editingLines, setEditingLines] = useState<Line[]>([]);
  const [isSavingPerf, setIsSavingPerf] = useState(false);

  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
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

  // ── Pre-fetch surrounding items ─────────────────────────────────────────
  const { getFromCache, addToCache } = useSetlistPrefetch(items, songPosition);

  // Load song content when position changes
  const loadSongAt = useCallback(async (pos: number, force = false) => {
    const item = items[pos];
    if (!item) return;

    if (!force) {
      const cached = getFromCache(item);
      if (cached) {
        if (cached.chart) { setCurrentChart(cached.chart); setCurrentLyrics(null); }
        else if (cached.lyrics) { setCurrentLyrics(cached.lyrics); setCurrentChart(null); }
        setContentLoading(false);
        return;
      }
    }

    setContentLoading(true);
    setCurrentChart(null);
    setCurrentLyrics(null);
    if (item.item_type === 'chart') {
      const chart = await readChart(item.item_id, force);
      if (chart) {
        let display = { ...chart } as ChartData;

        // Check for local or setlist performance copy override
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

        if (item.transpose_override) display = transposeChart(display, item.transpose_override, display.prefer_flats);
        setCurrentChart(display);
        addToCache(item, { chart: display });
      }
    } else {
      const lyr = await readLyrics(item.item_id);
      setCurrentLyrics(lyr);
      if (lyr) addToCache(item, { lyrics: lyr });
    }
    setContentLoading(false);
  }, [items, getFromCache, addToCache]);

  useEffect(() => { if (items.length > 0) loadSongAt(songPosition); }, [songPosition, items, loadSongAt]);

  // Performance Chord Editing Handlers
  const handleOpenPerfEdit = () => {
    if (!currentChart) return;
    setEditingLines(JSON.parse(JSON.stringify(currentChart.lines || [])));
    setPerfModalOpen(true);
  };

  const handleSavePerfCopy = async () => {
    const currentItem = items[songPosition];
    if (!currentItem || !currentChart) return;
    setIsSavingPerf(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`perf_lines_${currentItem.id}`, JSON.stringify(editingLines));
      }
      try {
        await updateSetlistItem(currentItem.id, { lines_override: editingLines });
      } catch (err) {
        console.warn('DB update failed, kept local performance copy:', err);
      }

      let updated: ChartData = { ...currentChart, lines: editingLines, is_performance_copy: true };
      if (currentItem.transpose_override) {
        updated = transposeChart(updated, currentItem.transpose_override, updated.prefer_flats);
      }
      setCurrentChart(updated);
      setPerfModalOpen(false);
    } catch (e) {
      alert('Failed to save performance copy');
    } finally {
      setIsSavingPerf(false);
    }
  };

  const handleRevertToMaster = async () => {
    const currentItem = items[songPosition];
    if (!currentItem) return;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`perf_lines_${currentItem.id}`);
    }
    try {
      await updateSetlistItem(currentItem.id, { lines_override: null });
    } catch (err) {}
    setPerfModalOpen(false);
    loadSongAt(songPosition, true);
  };

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

  // Intercept browser back button when leading a setlist sync session
  useEffect(() => {
    if (!isLeader) return;
    const currentUrl = window.location.href;
    try {
      window.history.pushState({ inSyncSession: true }, '', currentUrl);
    } catch {}

    const handlePopState = () => {
      try {
        window.history.pushState({ inSyncSession: true }, '', currentUrl);
      } catch {}
      setShowEndConfirmModal(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLeader]);

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
    <div className="min-h-screen bg-bg flex flex-col text-text-primary relative">

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
            onClick={() => isLeader ? setShowEndConfirmModal(true) : router.push(`/setlists/${setlistId}`)}
            className="p-2 text-text-secondary hover:text-white bg-surface-raised border border-border rounded-lg transition-all shrink-0"
            title="Close setlist performance"
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
            {/* Edit Chords (Performance Copy) button */}
            {currentItem?.item_type === 'chart' && currentChart && (
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenPerfEdit(); }}
                className="px-2.5 py-1 text-xs font-bold text-yellow-300 bg-yellow-500/15 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/25 transition-all flex items-center gap-1 shrink-0"
                title="Edit Chords for this Performance (Master chart in library stays unchanged)"
              >
                <Pencil size={13} />
                <span className="hidden sm:inline">Edit Performance Chords</span>
              </button>
            )}

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
              <button onClick={() => setShowEndConfirmModal(true)} className="px-2 py-1 text-[9px] font-bold text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg hover:bg-red-500 hover:text-white transition-all">
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

      {/* ── Performance Copy Badge Indicator ────────────────────────────── */}
      {currentChart?.is_performance_copy && (
        <div className="fixed top-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 rounded-full text-xs font-bold shadow-lg backdrop-blur-md animate-in fade-in">
          <Zap size={14} className="fill-yellow-300 shrink-0" />
          <span>⚡ Performance Copy (Master Unchanged)</span>
          <button
            onClick={(e) => { e.stopPropagation(); handleRevertToMaster(); }}
            className="ml-2 px-2 py-0.5 bg-yellow-500/30 hover:bg-yellow-500/50 rounded-md text-[10px] text-white transition-all"
            title="Revert to original master chart"
          >
            Revert
          </button>
        </div>
      )}

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

      {/* ── Edit Performance Chords Modal ─────────────────────────────────── */}
      {perfModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl p-6 shadow-popover flex flex-col gap-5 max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <Pencil size={18} className="text-yellow-400" />
                  <span>Edit Performance Chords</span>
                </h3>
                <p className="text-xs text-yellow-400/90 mt-1 font-medium">
                  ⚡ Edits apply ONLY to this performance setlist item. Master chart in library stays 100% unchanged.
                </p>
              </div>
              <button onClick={() => setPerfModalOpen(false)} className="p-1.5 text-text-secondary hover:text-white rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
              {editingLines.map((line, lineIdx) => (
                <div key={line.id || lineIdx} className="p-4 bg-surface-raised border border-border rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Section Label (e.g. Verse 1, Chorus)"
                      value={line.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingLines(prev => prev.map((l, i) => i === lineIdx ? { ...l, label: val } : l));
                      }}
                      className="px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-bold text-accent-start focus:outline-none focus:border-accent-solid w-48"
                    />
                    <button
                      onClick={() => {
                        setEditingLines(prev => prev.filter((_, i) => i !== lineIdx));
                      }}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Remove section line"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Blocks / Bars */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {line.blocks.map((block, blockIdx) => (
                      <div key={block.id || blockIdx} className="p-2.5 bg-surface border border-border/60 rounded-lg flex flex-col gap-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">Bar Group {blockIdx + 1}</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {block.bars.map((bar, barIdx) => (
                            <input
                              key={barIdx}
                              type="text"
                              placeholder="e.g. C, G, Am"
                              value={bar}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingLines(prev => prev.map((l, i) => {
                                  if (i !== lineIdx) return l;
                                  const newBlocks = l.blocks.map((b, bi) => {
                                    if (bi !== blockIdx) return b;
                                    const newBars = [...b.bars];
                                    newBars[barIdx] = val;
                                    return { ...b, bars: newBars };
                                  });
                                  return { ...l, blocks: newBlocks };
                                }));
                              }}
                              className="px-2.5 py-1 bg-surface-raised border border-border/80 rounded text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-accent-solid"
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={() => setEditingLines(prev => [...prev, createDefaultLine()])}
                className="py-2.5 px-4 bg-surface-raised border border-dashed border-border rounded-xl text-xs font-bold text-text-secondary hover:text-white hover:border-accent-solid transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add Section Line
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 gap-3">
              {currentChart?.is_performance_copy && (
                <button
                  onClick={handleRevertToMaster}
                  className="px-3 py-2 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <RotateCcw size={14} /> Revert to Original Master
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setPerfModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-text-secondary hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePerfCopy}
                  disabled={isSavingPerf}
                  className="px-5 py-2.5 bg-accent-gradient text-white text-xs font-bold rounded-xl shadow-md hover:brightness-110 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save size={15} />
                  <span>{isSavingPerf ? 'Saving...' : 'Save Performance Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── End Session Confirmation Modal ── */}
      {showEndConfirmModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-surface border border-border shadow-2xl rounded-3xl p-6 sm:p-8 w-full max-w-sm flex flex-col gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-500">
              <Radio size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-primary">End Setlist Sync Session?</h3>
              <p className="text-xs text-text-secondary mt-2 leading-relaxed font-medium">
                Are you sure you want to end this performance session for all connected followers?
              </p>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={() => setShowEndConfirmModal(false)}
                className="flex-1 py-3 px-4 bg-surface-raised border border-border rounded-xl text-xs font-bold text-text-secondary hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEndConfirmModal(false);
                  handleEndSession();
                }}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold text-white shadow-md hover:shadow-red-600/30 transition-all"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
