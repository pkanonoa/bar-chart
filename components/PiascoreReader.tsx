'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChartData } from '@/lib/chart-types';
import { ChartRenderer } from '@/components/ChartRenderer';
import { SongPickerModal, PickedItem } from '@/components/SongPickerModal';
import { transposeChart } from '@/lib/transpose';
import { readChart, toggleBookmark, getBookmarks } from '@/lib/storage';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import {
  FolderOpen, Smile, X, Plus, Play, Pause, Bookmark as BookmarkIcon,
  Crop, LayoutGrid, Info, Edit3, ArrowUpDown, BookOpen, Volume2,
  ChevronRight, ArrowLeft, RotateCcw, Sliders, ScrollText
} from 'lucide-react';

interface TabItem {
  id: string;
  title: string;
  artist?: string;
  chart?: ChartData;
}

interface Props {
  initialChart: ChartData;
  folderId?: string | null;
  onLeaderStart?: (code: string) => void;
  onFollowStart?: (code: string) => void;
}

// ── Inner chart zoom reset wrapper ──────────────────────────────────────────────
function ChartContentWrapper({ chart, selectedFont, chordColor }: { chart: ChartData; selectedFont: string; chordColor: string }) {
  const { zoomToElement } = useControls();

  useEffect(() => {
    let t: any;
    const fit = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        zoomToElement('piascore-chart-card', undefined, 0);
      }, 150);
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, [zoomToElement, chart.id]);

  return <ChartRenderer chart={chart} selectedFont={selectedFont} chordColor={chordColor} id="piascore-chart-card" />;
}

export function PiascoreReader({ initialChart, folderId, onLeaderStart, onFollowStart }: Props) {
  const router = useRouter();

  // ── Open Tabs State ─────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: initialChart.id,
      title: initialChart.title || 'Untitled',
      artist: initialChart.custom_text || 'Composer',
      chart: initialChart,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(initialChart.id);
  const [isSongPickerOpen, setIsSongPickerOpen] = useState(false);

  // Active chart calculation
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const [currentChart, setCurrentChart] = useState<ChartData>(
    activeTab?.chart || initialChart
  );

  // Load chart when active tab changes
  useEffect(() => {
    if (!activeTab) return;
    if (activeTab.chart) {
      setCurrentChart(activeTab.chart);
    } else {
      readChart(activeTab.id).then((data) => {
        if (data) {
          const c = data as ChartData;
          setCurrentChart(c);
          setTabs((prev) =>
            prev.map((t) => (t.id === c.id ? { ...t, chart: c, title: c.title } : t))
          );
        }
      });
    }
  }, [activeTabId, activeTab]);

  // ── UI Auto-hide / Header Toggle ────────────────────────────────────────────
  const [showUI, setShowUI] = useState(true);
  
  const closeAllPopups = () => {
    setIsBookmarkOpen(false);
    setIsAdjustOpen(false);
    setIsPageOverviewOpen(false);
    setIsInfoOpen(false);
    setIsMetronomeOpen(false);
  };

  const handleCanvasClick = () => {
    const hasOpenPopup = isBookmarkOpen || isAdjustOpen || isPageOverviewOpen || isInfoOpen || isMetronomeOpen;
    if (hasOpenPopup) {
      closeAllPopups();
      return;
    }
    setShowUI((prev) => {
      if (prev) closeAllPopups();
      return !prev;
    });
  };
  const toggleUI = handleCanvasClick;

  // ── Page Position / Line Slider ─────────────────────────────────────────────
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const totalLines = currentChart.lines?.length || 1;

  // ── Scroll Mode & Auto-Scroll Engine ──────────────────────────────────────
  const [viewMode, setViewMode] = useState<'scroll' | 'fit'>('scroll');
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(1.5);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAutoScrolling) return;
    let animId: number;

    const step = () => {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTop += scrollSpeed * 0.8;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
          setIsAutoScrolling(false);
          return;
        }
      } else {
        window.scrollBy({ top: scrollSpeed * 0.8, behavior: 'instant' });
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isAutoScrolling, scrollSpeed]);

  // ── Metronome State & Engine ────────────────────────────────────────────────
  const [isMetronomeOpen, setIsMetronomeOpen] = useState(false);
  const [bpm, setBpm] = useState<number>(currentChart.tempo || 120);
  const [timeSig, setTimeSig] = useState<string>(currentChart.time_sig || '4/4');
  const [isPlayingMetronome, setIsPlayingMetronome] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync tempo when chart changes
  useEffect(() => {
    if (currentChart.tempo) setBpm(currentChart.tempo);
    if (currentChart.time_sig) setTimeSig(currentChart.time_sig);
  }, [currentChart]);

  const beatsPerMeasure = parseInt(timeSig.split('/')[0]) || 4;

  const playClick = useCallback((isFirstBeat: boolean) => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isFirstBeat ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(isFirstBeat ? 1000 : 700, ctx.currentTime);

      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.log('Metronome audio error:', e);
    }
  }, []);

  useEffect(() => {
    if (isPlayingMetronome) {
      const intervalMs = (60 / bpm) * 1000;
      let beatCounter = 0;
      playClick(true);
      setCurrentBeat(0);

      timerRef.current = setInterval(() => {
        beatCounter = (beatCounter + 1) % beatsPerMeasure;
        setCurrentBeat(beatCounter);
        playClick(beatCounter === 0);
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCurrentBeat(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlayingMetronome, bpm, beatsPerMeasure, playClick]);

  // ── Modals State ─────────────────────────────────────────────────────────────
  const [isBookmarkOpen, setIsBookmarkOpen] = useState(false);
  const [bookmarksList, setBookmarksList] = useState<any[]>([]);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncJoinCodeInput, setSyncJoinCodeInput] = useState('');
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isPageOverviewOpen, setIsPageOverviewOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Settings
  const [selectedFont, setSelectedFont] = useState('system');
  const [chordColor, setChordColor] = useState('#0f172a');

  useEffect(() => {
    const saved = localStorage.getItem('chord-grid-font');
    if (saved) setSelectedFont(saved);
    const savedColor = localStorage.getItem('chord-grid-chord-color');
    if (savedColor) setChordColor(savedColor);
  }, []);

  // Load bookmarks list
  const refreshBookmarks = async () => {
    const list = await getBookmarks();
    setBookmarksList(list.filter((b) => b.type === 'chart'));
  };

  useEffect(() => {
    refreshBookmarks();
  }, []);

  // Transpose helper
  const handleTranspose = (delta: number) => {
    if (!currentChart) return;
    const updated = transposeChart(currentChart, delta, currentChart.prefer_flats);
    setCurrentChart(updated);
    setTabs((prev) =>
      prev.map((t) => (t.id === updated.id ? { ...t, chart: updated } : t))
    );
  };

  // Add / Switch open tabs
  const handleAddPickedSongs = async (pickedItems: PickedItem[]) => {
    for (const item of pickedItems) {
      if (item.item_type === 'chart') {
        const existing = tabs.find((t) => t.id === item.item_id);
        if (existing) {
          setActiveTabId(existing.id);
        } else {
          const chartData = await readChart(item.item_id);
          const newTab: TabItem = {
            id: item.item_id,
            title: item.title,
            chart: chartData as ChartData,
          };
          setTabs((prev) => [...prev, newTab]);
          setActiveTabId(newTab.id);
        }
      }
    }
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return; // Keep at least one tab
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  // Bookmark toggle & opening in tab
  const handleAddCurrentBookmark = async () => {
    if (!currentChart) return;
    const isBookmarked = bookmarksList.some((b) => b.id === currentChart.id);
    await toggleBookmark(currentChart.id, 'chart', !isBookmarked);
    await refreshBookmarks();
  };

  const handleOpenBookmarkInTab = async (bm: any) => {
    const existingTab = tabs.find((t) => t.id === bm.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const c = await readChart(bm.id);
      if (c) {
        const chartData = c as ChartData;
        const newTab: TabItem = {
          id: chartData.id,
          title: chartData.title || 'Untitled',
          artist: chartData.custom_text || 'Composer',
          chart: chartData,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      }
    }
    setIsBookmarkOpen(false);
  };

  // Leader / Follow session trigger
  const handleStartLeader = () => {
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();
    sessionStorage.setItem(
      `perform-leader-${code}`,
      JSON.stringify({
        chartIds: tabs.map((t) => t.id),
        sessionName: currentChart.title || 'Live Performance',
      })
    );
    setIsSyncModalOpen(false);
    if (onLeaderStart) {
      onLeaderStart(code);
    } else {
      router.push(`/perform/${code}`);
    }
  };

  const handleStartFollow = () => {
    const c = syncJoinCodeInput.trim().toUpperCase();
    if (c.length === 6) {
      setIsSyncModalOpen(false);
      if (onFollowStart) {
        onFollowStart(c);
      } else {
        router.push(`/perform/${c}`);
      }
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#e8e8ec] dark:bg-[#121214] text-slate-800 dark:text-slate-100 flex flex-col overflow-hidden select-none font-sans">
      {/* ── 1. TOP HEADER (Piascore Style) ────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 bg-[#f8f8fa]/95 dark:bg-[#1a1a1e]/95 backdrop-blur-md border-b border-slate-300 dark:border-slate-800 flex items-center justify-between px-3 h-12 transition-transform duration-300 ${
          showUI ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        {/* Left: Catalog Button */}
        <button
          onClick={() =>
            router.push(folderId ? `/folder/${folderId}` : '/')
          }
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#007aff] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95"
        >
          <FolderOpen size={16} className="text-[#007aff]" />
          <span>Catalog</span>
        </button>

        {/* Center: Song Title & Composer */}
        <div className="flex flex-col items-center justify-center text-center max-w-[50vw]">
          <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight">
            {currentChart.title || 'Untitled'} ({currentLineIndex + 1}/{totalLines})
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            {currentChart.custom_text || 'ChordCraft Score'}
          </p>
        </div>

        {/* Right: Gesture / Sync Button */}
        <button
          onClick={() => setIsSyncModalOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#007aff] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95"
        >
          <Smile size={16} className="text-[#007aff]" />
          <span>Gesture</span>
        </button>
      </header>

      {/* ── 2. DOCUMENT TAB NAVIGATION BAR (Below Header) ──────────────────── */}
      <nav
        className={`fixed top-12 left-0 right-0 z-40 bg-[#dedede] dark:bg-[#202024] border-b border-slate-300 dark:border-slate-800 flex items-center px-2 h-9 gap-1 overflow-x-auto scrollbar-none transition-transform duration-300 ${
          showUI ? 'translate-y-0' : '-translate-y-[5.25rem]'
        }`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-md cursor-pointer border border-b-0 transition-all max-w-[180px] shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-[#121214] text-slate-900 dark:text-white border-slate-300 dark:border-slate-800 font-bold shadow-sm'
                  : 'bg-[#cfcfd3] dark:bg-[#2a2a2e] text-slate-600 dark:text-slate-400 border-transparent hover:bg-white/50'
              }`}
            >
              {/* Active Gradient Line Indicator */}
              {isActive && (
                <span className="absolute top-0 left-0 right-0 h-[2.5px] bg-accent-gradient shadow-[0_0_8px_rgba(117,52,255,0.6)]" />
              )}
              <span className="truncate flex-1">{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-black/10 transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}

        {/* Plus Tab Button */}
        <button
          onClick={() => setIsSongPickerOpen(true)}
          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-accent-start hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-all shrink-0 ml-1"
          title="Open song in new tab"
        >
          <Plus size={15} />
        </button>
      </nav>

      {/* ── 3. FLOATING LEFT METRONOME TAB BUTTON ────────────────────────── */}
      <button
        onClick={() => setIsMetronomeOpen((prev) => !prev)}
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-white/90 dark:bg-[#1a1a1e]/90 backdrop-blur-md border border-l-0 border-slate-300 dark:border-slate-700 shadow-md rounded-r-xl px-2 py-3 flex flex-col items-center gap-1.5 text-accent-start hover:px-3 transition-all ${
          showUI ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'
        }`}
      >
        <Volume2 size={16} className={isPlayingMetronome ? 'animate-bounce' : ''} />
        <span
          className="text-[10px] font-bold tracking-widest uppercase text-slate-700 dark:text-slate-300"
          style={{ writingMode: 'vertical-rl' }}
        >
          Metronome
        </span>
      </button>

      {/* ── METRONOME CONTROL DRAWER ──────────────────────────────────────── */}
      {isMetronomeOpen && (
        <div className="fixed left-12 top-1/2 -translate-y-1/2 z-50 w-72 bg-white dark:bg-[#1e1e24] border border-slate-300 dark:border-slate-700 shadow-2xl rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Volume2 size={16} className="text-accent-start" /> Metronome
            </h3>
            <button
              onClick={() => setIsMetronomeOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* Visual Beat Indicator Dots */}
          <div className="flex justify-center items-center gap-2 py-1">
            {Array.from({ length: beatsPerMeasure }).map((_, idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all ${
                  isPlayingMetronome && currentBeat === idx
                    ? idx === 0
                      ? 'bg-red-500 scale-125 shadow-[0_0_10px_rgba(239,68,68,0.8)]'
                      : 'bg-accent-start scale-110 shadow-[0_0_8px_rgba(117,52,255,0.8)]'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* BPM Display & Buttons */}
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-xl">
            <button
              onClick={() => setBpm((b) => Math.max(30, b - 5))}
              className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 shadow-sm active:scale-95"
            >
              -5
            </button>
            <div className="text-center">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {bpm}
              </span>
              <span className="block text-[9px] font-bold text-slate-400 uppercase">BPM</span>
            </div>
            <button
              onClick={() => setBpm((b) => Math.min(260, b + 5))}
              className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 shadow-sm active:scale-95"
            >
              +5
            </button>
          </div>



          {/* Time Signature Options */}
          <div className="flex items-center justify-between gap-1 text-xs">
            {['4/4', '3/4', '6/8', '2/4'].map((ts) => (
              <button
                key={ts}
                onClick={() => setTimeSig(ts)}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  timeSig === ts
                    ? 'bg-accent-gradient text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {ts}
              </button>
            ))}
          </div>

          {/* Play / Stop Button */}
          <button
            onClick={() => setIsPlayingMetronome((p) => !p)}
            className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-white shadow-md transition-all active:scale-98 ${
              isPlayingMetronome
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-accent-gradient hover:brightness-110'
            }`}
          >
            {isPlayingMetronome ? (
              <>
                <Pause size={18} /> Stop Metronome
              </>
            ) : (
              <>
                <Play size={18} /> Start Metronome
              </>
            )}
          </button>
        </div>
      )}

      {/* ── FLOATING SCROLL & AUTO-SCROLL QUICK CONTROL ────────────────────── */}
      <div className={`fixed top-14 right-4 z-40 transition-all duration-300 ${
        showUI || isAutoScrolling ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
      }`}>
        <div className="flex items-center gap-2 p-1.5 bg-[#1e1e24]/90 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl text-xs font-bold text-white select-none">
          <button
            onClick={() => setViewMode(v => v === 'scroll' ? 'fit' : 'scroll')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              viewMode === 'scroll' ? 'bg-[#007aff] text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Toggle Vertical Scroll / Fit Canvas"
          >
            <ScrollText size={14} />
            <span>{viewMode === 'scroll' ? 'Scroll' : 'Fit Canvas'}</span>
          </button>

          {viewMode === 'scroll' && (
            <>
              <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />
              <button
                onClick={() => setIsAutoScrolling(p => !p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                  isAutoScrolling ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title={isAutoScrolling ? 'Pause Auto-Scroll' : 'Start Auto-Scroll'}
              >
                {isAutoScrolling ? <Pause size={14} /> : <Play size={14} />}
                <span>{isAutoScrolling ? 'Auto-Scrolling' : 'Auto Scroll'}</span>
              </button>

              {isAutoScrolling && (
                <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-xl">
                  {[0.5, 1, 1.5, 2, 3].map((s) => (
                    <button
                      key={s}
                      onClick={() => setScrollSpeed(s)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        scrollSpeed === s ? 'bg-[#007aff] text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 4. MAIN SCORE READER CANVAS ───────────────────────────────────── */}
      {viewMode === 'scroll' ? (
        <main
          ref={scrollContainerRef}
          className="flex-1 w-full h-full relative overflow-y-auto overflow-x-auto scroll-smooth flex flex-col items-center justify-start p-2 sm:p-6 pt-16 sm:pt-20 pb-20 cursor-pointer"
          onClick={toggleUI}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              toggleUI();
            }}
            className="bg-white text-slate-900 shadow-2xl rounded-2xl p-4 sm:p-8 md:p-10 w-fit min-w-full max-w-none border border-slate-200/80 my-2"
          >
            <ChartRenderer chart={currentChart} selectedFont={selectedFont} chordColor={chordColor} id="piascore-chart-card" />
          </div>
        </main>
      ) : (
        <main
          className="flex-1 w-full h-full relative overflow-hidden flex items-stretch justify-center cursor-pointer"
          onClick={toggleUI}
        >
          <TransformWrapper
            initialScale={1}
            minScale={0.2}
            maxScale={4}
            centerOnInit={true}
            centerZoomedOut={true}
            doubleClick={{ disabled: true }}
          >
            <TransformComponent
              wrapperClass="!w-full !h-full"
              contentClass="w-full min-w-full min-h-full flex items-stretch justify-center p-2 sm:p-4 md:p-6 pt-16 sm:pt-20 pb-16 sm:pb-20"
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleUI();
                }}
                className="bg-white text-slate-900 shadow-2xl rounded-2xl p-4 sm:p-8 md:p-10 w-full max-w-none border border-slate-200/80 flex items-stretch"
              >
                <ChartContentWrapper chart={currentChart} selectedFont={selectedFont} chordColor={chordColor} />
              </div>
            </TransformComponent>
          </TransformWrapper>
        </main>
      )}



      {/* ── 6. BOTTOM ACTION TOOLBAR (5 Icons matching Piascore) ────────── */}
      <footer
        className={`fixed bottom-0 left-0 right-0 z-50 bg-[#f8f8fa]/95 dark:bg-[#1a1a1e]/95 backdrop-blur-md border-t border-slate-300 dark:border-slate-800 flex items-center justify-around h-14 px-2 transition-transform duration-300 ${
          showUI ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Button 1: Bookmark */}
        <button
          onClick={() => {
            setIsBookmarkOpen((p) => !p);
            setIsAdjustOpen(false);
            setIsPageOverviewOpen(false);
            setIsInfoOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-all active:scale-95 ${
            isBookmarkOpen ? 'text-[#007aff]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookmarkIcon size={20} />
          <span>Bookmark</span>
        </button>

        {/* Button 2: Adjust Page */}
        <button
          onClick={() => {
            setIsAdjustOpen((p) => !p);
            setIsBookmarkOpen(false);
            setIsPageOverviewOpen(false);
            setIsInfoOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-all active:scale-95 ${
            isAdjustOpen ? 'text-[#007aff]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Crop size={20} />
          <span>Adjust Page</span>
        </button>

        {/* Button 3: Page */}
        <button
          onClick={() => {
            setIsPageOverviewOpen((p) => !p);
            setIsBookmarkOpen(false);
            setIsAdjustOpen(false);
            setIsInfoOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-all active:scale-95 ${
            isPageOverviewOpen ? 'text-[#007aff]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LayoutGrid size={20} />
          <span>Page</span>
        </button>

        {/* Button 4: Info */}
        <button
          onClick={() => {
            setIsInfoOpen((p) => !p);
            setIsBookmarkOpen(false);
            setIsAdjustOpen(false);
            setIsPageOverviewOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-all active:scale-95 ${
            isInfoOpen ? 'text-[#007aff]' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Info size={20} />
          <span>Info</span>
        </button>

        {/* Button 5: Writing */}
        <button
          onClick={() => router.push(`/chart/${currentChart.id}/edit`)}
          className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-[#007aff] transition-all active:scale-95"
        >
          <Edit3 size={20} />
          <span>Writing</span>
        </button>
      </footer>

      {/* ── 7. BOOKMARK POPOVER MODAL (Image 1 Model) ─────────────────────── */}
      {isBookmarkOpen && (
        <div className="fixed bottom-16 left-4 z-50 w-80 max-w-[90vw] bg-white dark:bg-[#1e1e24] border border-slate-300 dark:border-slate-700 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-96 animate-in slide-in-from-bottom-2 duration-200">
          {/* Header matching Image 1: < [=], ⇅, Title: Bookmark, + */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#16161a]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsBookmarkOpen(false)}
                className="p-1 text-[#007aff] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
              >
                <BookOpen size={18} />
              </button>
              <button className="p-1 text-[#007aff] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg">
                <ArrowUpDown size={18} />
              </button>
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Bookmark</h2>
            <button
              onClick={handleAddCurrentBookmark}
              className={`p-1 rounded-lg active:scale-95 transition-all ${
                bookmarksList.some((b) => b.id === currentChart.id)
                  ? 'text-accent-start bg-accent-start/10 font-bold'
                  : 'text-[#007aff] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={
                bookmarksList.some((b) => b.id === currentChart.id)
                  ? 'Remove from bookmarks'
                  : 'Add to bookmarks'
              }
            >
              <Plus size={20} className={bookmarksList.some((b) => b.id === currentChart.id) ? 'rotate-45 transition-transform' : ''} />
            </button>
          </div>

          {/* List of bookmarks */}
          <div className="overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800">
            {bookmarksList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No bookmarks added yet. Tap <Plus size={12} className="inline text-[#007aff]" /> to bookmark this chart.
              </div>
            ) : (
              bookmarksList.map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => handleOpenBookmarkInTab(bm)}
                  className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 truncate">
                    <BookmarkIcon size={16} className="text-[#007aff] shrink-0 fill-[#007aff]" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {bm.title}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 8. SYNC PAGE TURNING MODAL (Image 2 Model) ────────────────────── */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1c1c22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center flex flex-col items-center gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Sync page turning
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              You can sync page turning between several devices.
              <br />
              (&quot;Follow&quot; follows &quot;Lead&quot;&apos;s a page-turning)
            </p>

            {/* Input code for follow */}
            <input
              type="text"
              placeholder="Session code (e.g. ABC123)"
              maxLength={6}
              value={syncJoinCodeInput}
              onChange={(e) => setSyncJoinCodeInput(e.target.value.toUpperCase())}
              className="w-full text-center px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono uppercase font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#007aff]"
            />

            {/* Action Buttons Stack (Image 2 Style) */}
            <div className="w-full flex flex-col divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-2">
              <button
                onClick={handleStartLeader}
                className="w-full py-3 text-sm font-bold text-[#007aff] hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 transition-colors"
              >
                Lead
              </button>
              <button
                onClick={handleStartFollow}
                disabled={syncJoinCodeInput.trim().length !== 6}
                className="w-full py-3 text-sm font-bold text-[#007aff] hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Follow
              </button>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="w-full py-3 text-sm font-bold text-[#007aff] hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 9. ADJUST PAGE PANEL ─────────────────────────────────────────── */}
      {isAdjustOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-80 bg-white dark:bg-[#1e1e24] border border-slate-300 dark:border-slate-700 shadow-2xl rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Crop size={16} className="text-[#007aff]" /> Display & Scroll Mode
            </h3>
            <button
              onClick={() => setIsAdjustOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          {/* View Mode Toggle: Scroll vs Fit */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">View Mode</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
              <button
                onClick={() => setViewMode('scroll')}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  viewMode === 'scroll'
                    ? 'bg-[#007aff] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ScrollText size={15} /> Vertical Scroll
              </button>
              <button
                onClick={() => {
                  setViewMode('fit');
                  setIsAutoScrolling(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  viewMode === 'fit'
                    ? 'bg-[#007aff] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Crop size={15} /> Fit Canvas
              </button>
            </div>
          </div>

          {/* Auto Scroll Controls */}
          {viewMode === 'scroll' && (
            <div className="flex flex-col gap-1.5 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Play size={13} className="text-emerald-500" /> Auto-Scroll
                </label>
                <button
                  onClick={() => setIsAutoScrolling((p) => !p)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    isAutoScrolling
                      ? 'bg-emerald-600 text-white animate-pulse'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white'
                  }`}
                >
                  {isAutoScrolling ? <Pause size={12} /> : <Play size={12} />}
                  <span>{isAutoScrolling ? 'Pause' : 'Start'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] font-semibold text-slate-500">Speed</span>
                <div className="flex items-center gap-1">
                  {[0.5, 1, 1.5, 2, 3].map((s) => (
                    <button
                      key={s}
                      onClick={() => setScrollSpeed(s)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        scrollSpeed === s
                          ? 'bg-[#007aff] text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Transpose Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Transpose Key</label>
            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-xl">
              <button
                onClick={() => handleTranspose(-1)}
                className="w-9 h-9 rounded-lg bg-white dark:bg-slate-700 font-bold text-slate-800 dark:text-white shadow-sm active:scale-95 text-lg"
              >
                -
              </button>
              <span className="text-xs font-mono font-bold text-[#007aff]">
                {currentChart.semitone_offset === 0
                  ? 'Original'
                  : `${currentChart.semitone_offset > 0 ? '+' : ''}${currentChart.semitone_offset} semitones`}
              </span>
              <button
                onClick={() => handleTranspose(1)}
                className="w-9 h-9 rounded-lg bg-white dark:bg-slate-700 font-bold text-slate-800 dark:text-white shadow-sm active:scale-95 text-lg"
              >
                +
              </button>
            </div>
          </div>

          {/* Font Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Font Style</label>
            <select
              value={selectedFont}
              onChange={(e) => {
                const f = e.target.value;
                setSelectedFont(f);
                localStorage.setItem('chord-grid-font', f);
              }}
              className="w-full p-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="system">System Default</option>
              <option value="outfit">Outfit Clean</option>
              <option value="serif">Classic Serif</option>
              <option value="mono">Monospace</option>
            </select>
          </div>

          {/* Part Name & Chord Color */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Part Name & Chord Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: 'Ink',     color: '#0f172a' },
                { label: 'Indigo',  color: '#4f46e5' },
                { label: 'Blue',    color: '#2563eb' },
                { label: 'Purple',  color: '#7c3aed' },
                { label: 'Rose',    color: '#e11d48' },
                { label: 'Teal',    color: '#0d9488' },
                { label: 'Amber',   color: '#d97706' },
                { label: 'Slate',   color: '#475569' },
              ].map(({ label, color }) => (
                <button
                  key={color}
                  title={label}
                  onClick={() => {
                    setChordColor(color);
                    localStorage.setItem('chord-grid-chord-color', color);
                  }}
                  className={`w-7 h-7 rounded-full border-2 transition-all active:scale-90 ${
                    chordColor === color
                      ? 'border-slate-900 dark:border-white scale-110 shadow-md'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 10. PAGE GRID OVERVIEW PANEL ─────────────────────────────────── */}
      {isPageOverviewOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-80 bg-white dark:bg-[#1e1e24] border border-slate-300 dark:border-slate-700 shadow-2xl rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <LayoutGrid size={16} className="text-[#007aff]" /> Section Overview
            </h3>
            <button
              onClick={() => setIsPageOverviewOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
            {currentChart.lines?.map((line: any, idx: number) => (
              <button
                key={line.id || idx}
                onClick={() => {
                  setCurrentLineIndex(idx);
                  setIsPageOverviewOpen(false);
                }}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  currentLineIndex === idx
                    ? 'border-[#007aff] bg-[#007aff]/10 text-[#007aff] font-bold'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Section {idx + 1}
                </span>
                <span className="text-xs truncate font-semibold">
                  {line.label || `Line ${idx + 1}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 11. INFO PANEL ──────────────────────────────────────────────── */}
      {isInfoOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-72 bg-white dark:bg-[#1e1e24] border border-slate-300 dark:border-slate-700 shadow-2xl rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Info size={16} className="text-[#007aff]" /> Score Details
            </h3>
            <button
              onClick={() => setIsInfoOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Title:</span>
              <span className="font-bold">{currentChart.title || 'Untitled'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Tempo:</span>
              <span className="font-mono font-bold">{currentChart.tempo || 120} BPM</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Time Signature:</span>
              <span className="font-mono font-bold">{currentChart.time_sig || '4/4'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Sections / Lines:</span>
              <span className="font-bold">{totalLines}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Key Offset:</span>
              <span className="font-mono font-bold">
                {currentChart.semitone_offset === 0 ? 'Original' : `${currentChart.semitone_offset} semitones`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 12. SONG PICKER MODAL (Add Tab) ────────────────────────────── */}
      <SongPickerModal
        isOpen={isSongPickerOpen}
        onClose={() => setIsSongPickerOpen(false)}
        onAdd={handleAddPickedSongs}
        existingIds={tabs.map((t) => t.id)}
      />
    </div>
  );
}
