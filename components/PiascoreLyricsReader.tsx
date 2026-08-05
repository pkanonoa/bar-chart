'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lyric, readLyrics } from '@/lib/lyrics';
import { SongPickerModal, PickedItem } from '@/components/SongPickerModal';
import { toggleBookmark, getBookmarks } from '@/lib/storage';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import {
  FolderOpen, Smile, X, Plus, Play, Pause, Bookmark as BookmarkIcon,
  Crop, LayoutGrid, Info, Edit3, ArrowUpDown, BookOpen, Volume2,
  ChevronRight, Type, AlignLeft, AlignCenter, AlignRight, ScrollText
} from 'lucide-react';

interface TabItem {
  id: string;
  title: string;
  artist?: string;
  lyric?: Lyric;
}

interface Props {
  initialLyric: Lyric;
  folderId?: string | null;
}

// ── Inner lyrics card component (no zoom controls hook dependency) ─────────────────
function PlainLyricsCard({
  lyric,
  selectedFont,
  textColor,
  textAlign = 'center',
}: {
  lyric: Lyric;
  selectedFont: string;
  textColor: string;
  textAlign?: 'center' | 'left' | 'right';
}) {
  const paragraphs = lyric.body ? lyric.body.split('\n\n') : [];

  return (
    <div
      id="piascore-lyrics-card"
      className={`inline-flex flex-col w-full max-w-4xl p-6 sm:p-12 md:p-16 bg-white text-slate-900 shadow-2xl rounded-2xl border border-slate-200/80 relative select-none min-h-[70vh] ${
        textAlign === 'left' ? 'text-left items-start' : textAlign === 'right' ? 'text-right items-end' : 'text-center items-center'
      }`}
      style={{
        fontFamily:
          selectedFont === 'serif'
            ? 'Georgia, serif'
            : selectedFont === 'mono'
            ? 'monospace'
            : 'system-ui, -apple-system, sans-serif',
        color: textColor,
      }}
    >
      {/* Title Header */}
      <div className="flex flex-col items-center justify-center mb-8 pb-6 border-b border-slate-200 w-full">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center text-slate-900">
          {lyric.title || 'Untitled Lyrics'}
        </h1>
      </div>

      {/* Lyrics Body */}
      <div className={`flex flex-col gap-6 w-full font-medium text-lg sm:text-xl leading-relaxed whitespace-pre-wrap ${
        textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center'
      }`}>
        {paragraphs.map((stanza, idx) => (
          <div key={idx} className={`p-2 rounded-xl hover:bg-slate-50 transition-colors w-full ${
            textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center'
          }`}>
            {stanza}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inner lyrics zoom reset wrapper ─────────────────────────────────────────────
function LyricsContentWrapper(props: {
  lyric: Lyric;
  selectedFont: string;
  textColor: string;
  textAlign?: 'center' | 'left' | 'right';
}) {
  const { zoomToElement } = useControls();

  useEffect(() => {
    let t: any;
    const fit = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        zoomToElement('piascore-lyrics-card', undefined, 0);
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
  }, [zoomToElement, props.lyric.id]);

  return <PlainLyricsCard {...props} />;
}

export function PiascoreLyricsReader({ initialLyric, folderId }: Props) {
  const router = useRouter();

  // ── Open Tabs State ─────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: initialLyric.id,
      title: initialLyric.title || 'Untitled',
      lyric: initialLyric,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(initialLyric.id);
  const [isSongPickerOpen, setIsSongPickerOpen] = useState(false);

  // Active lyric calculation
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const [currentLyric, setCurrentLyric] = useState<Lyric>(
    activeTab?.lyric || initialLyric
  );

  // Load lyric when active tab changes
  useEffect(() => {
    if (!activeTab) return;
    if (activeTab.lyric) {
      setCurrentLyric(activeTab.lyric);
    } else {
      readLyrics(activeTab.id).then((data) => {
        if (data) {
          const l = data as Lyric;
          setCurrentLyric(l);
          setTabs((prev) =>
            prev.map((t) => (t.id === l.id ? { ...t, lyric: l, title: l.title } : t))
          );
        }
      });
    }
  }, [activeTabId, activeTab]);

  // ── UI Auto-hide / Popups Handler ──────────────────────────────────────────
  const [showUI, setShowUI] = useState(true);

  const closeAllPopups = () => {
    setIsBookmarkOpen(false);
    setIsAdjustOpen(false);
    setIsPageOverviewOpen(false);
    setIsInfoOpen(false);
    setIsMetronomeOpen(false);
  };

  const handleCanvasClick = () => {
    const hasOpenPopup =
      isBookmarkOpen ||
      isAdjustOpen ||
      isPageOverviewOpen ||
      isInfoOpen ||
      isMetronomeOpen;
    if (hasOpenPopup) {
      closeAllPopups();
      return;
    }
    setShowUI((prev) => {
      if (prev) closeAllPopups();
      return !prev;
    });
  };

  // ── Metronome State & Engine ────────────────────────────────────────────────
  const [isMetronomeOpen, setIsMetronomeOpen] = useState(false);
  const [bpm, setBpm] = useState<number>(120);
  const [timeSig, setTimeSig] = useState<string>('4/4');
  const [isPlayingMetronome, setIsPlayingMetronome] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
  const [textColor, setTextColor] = useState('#0f172a');
  const [textAlign, setTextAlign] = useState<'center' | 'left' | 'right'>('center');

  useEffect(() => {
    const saved = localStorage.getItem('chord-grid-font');
    if (saved) setSelectedFont(saved);
    const savedColor = localStorage.getItem('chord-grid-lyrics-color');
    if (savedColor) setTextColor(savedColor);
    const savedAlign = localStorage.getItem('chord-grid-lyrics-align') as 'center' | 'left' | 'right';
    if (savedAlign) setTextAlign(savedAlign);
  }, []);

  // Load bookmarks list
  const refreshBookmarks = async () => {
    const list = await getBookmarks();
    setBookmarksList(list.filter((b) => b.type === 'lyrics'));
  };

  useEffect(() => {
    refreshBookmarks();
  }, []);

  // Add / Switch open tabs
  const handleAddPickedSongs = async (pickedItems: PickedItem[]) => {
    for (const item of pickedItems) {
      const existing = tabs.find((t) => t.id === item.item_id);
      if (existing) {
        setActiveTabId(existing.id);
      } else {
        const lyricData = await readLyrics(item.item_id);
        if (lyricData) {
          const newTab: TabItem = {
            id: item.item_id,
            title: item.title,
            lyric: lyricData,
          };
          setTabs((prev) => [...prev, newTab]);
          setActiveTabId(newTab.id);
        }
      }
    }
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  const handleAddCurrentBookmark = async () => {
    if (!currentLyric) return;
    const isBookmarked = bookmarksList.some((b) => b.id === currentLyric.id);
    await toggleBookmark(currentLyric.id, 'lyrics', !isBookmarked);
    await refreshBookmarks();
  };

  const handleOpenBookmarkInTab = async (bm: any) => {
    const existingTab = tabs.find((t) => t.id === bm.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const l = await readLyrics(bm.id);
      if (l) {
        const lyricData = l as Lyric;
        const newTab: TabItem = {
          id: lyricData.id,
          title: lyricData.title || 'Untitled',
          lyric: lyricData,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      }
    }
    setIsBookmarkOpen(false);
  };

  const paragraphs = currentLyric.body ? currentLyric.body.split('\n\n') : [];

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
            router.push(folderId ? `/lyrics/folder/${folderId}` : '/lyrics')
          }
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-accent-start hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95"
        >
          <FolderOpen size={16} className="text-accent-start" />
          <span>Catalog</span>
        </button>

        {/* Center: Song Title & Subtitle */}
        <div className="flex flex-col items-center justify-center text-center max-w-[50vw]">
          <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight flex items-center gap-1.5">
            <Type size={14} className="text-accent-start" />
            {currentLyric.title || 'Untitled Lyrics'}
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            ChordCraft Lyrics Score
          </p>
        </div>

        {/* Right: Gesture / Sync Button */}
        <button
          onClick={() => setIsSyncModalOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-accent-start hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95"
        >
          <Smile size={16} className="text-accent-start" />
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
          title="Open lyrics in new tab"
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

      {/* ── 4. MAIN LYRICS READER CANVAS ───────────────────────────────────── */}
      <main
        className="flex-1 w-full h-full relative overflow-hidden flex items-stretch justify-center cursor-pointer"
        onClick={handleCanvasClick}
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
                handleCanvasClick();
              }}
              className="w-full flex items-stretch justify-center"
            >
              <LyricsContentWrapper
                lyric={currentLyric}
                selectedFont={selectedFont}
                textColor={textColor}
                textAlign={textAlign}
              />
            </div>
          </TransformComponent>
        </TransformWrapper>
      </main>

      {/* ── 5. BOTTOM ACTION TOOLBAR (5 Icons matching Piascore) ────────── */}
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
            isBookmarkOpen
              ? 'text-accent-start'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
            isAdjustOpen
              ? 'text-accent-start'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
            isPageOverviewOpen
              ? 'text-accent-start'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
            isInfoOpen
              ? 'text-accent-start'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Info size={20} />
          <span>Info</span>
        </button>

        {/* Button 5: Writing */}
        <button
          onClick={() => router.push(`/lyrics/${currentLyric.id}/edit`)}
          className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-accent-start transition-all active:scale-95"
        >
          <Edit3 size={20} />
          <span>Writing</span>
        </button>
      </footer>

      {/* ── 6. BOOKMARK POPOVER MODAL ─────────────────────────────────────── */}
      {isBookmarkOpen && (
        <div className="fixed bottom-16 left-4 z-50 w-80 max-w-[90vw] bg-white dark:bg-[#1e1e24] border border-slate-300 dark:border-slate-700 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-96 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#16161a]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsBookmarkOpen(false)}
                className="p-1 text-accent-start hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
              >
                <BookOpen size={18} />
              </button>
              <button className="p-1 text-accent-start hover:bg-black/5 dark:hover:bg-white/5 rounded-lg">
                <ArrowUpDown size={18} />
              </button>
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Bookmark</h2>
            <button
              onClick={handleAddCurrentBookmark}
              className={`p-1 rounded-lg active:scale-95 transition-all ${
                bookmarksList.some((b) => b.id === currentLyric.id)
                  ? 'text-accent-start bg-accent-start/10 font-bold'
                  : 'text-accent-start hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={
                bookmarksList.some((b) => b.id === currentLyric.id)
                  ? 'Remove from bookmarks'
                  : 'Add to bookmarks'
              }
            >
              <Plus size={20} className={bookmarksList.some((b) => b.id === currentLyric.id) ? 'rotate-45 transition-transform' : ''} />
            </button>
          </div>

          <div className="overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800">
            {bookmarksList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No bookmarks added yet. Tap <Plus size={12} className="inline text-accent-start" /> to bookmark this lyric.
              </div>
            ) : (
              bookmarksList.map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => handleOpenBookmarkInTab(bm)}
                  className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 truncate">
                    <BookmarkIcon size={16} className="text-accent-start shrink-0 fill-accent-start" />
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

      {/* ── 7. SYNC PAGE TURNING MODAL ────────────────────────────────────── */}
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

            <input
              type="text"
              placeholder="Session code (e.g. ABC123)"
              maxLength={6}
              value={syncJoinCodeInput}
              onChange={(e) => setSyncJoinCodeInput(e.target.value.toUpperCase())}
              className="w-full text-center px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono uppercase font-bold text-slate-900 dark:text-white focus:outline-none focus:border-accent-start"
            />

            <div className="w-full flex flex-col divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-2">
              <button
                onClick={() => {
                  const code = Math.random().toString(36).substr(2, 6).toUpperCase();
                  router.push(`/perform/${code}`);
                }}
                className="w-full py-3 text-sm font-bold text-accent-start hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 transition-colors"
              >
                Lead
              </button>
              <button
                onClick={() => {
                  if (syncJoinCodeInput.trim().length === 6) {
                    router.push(`/perform/${syncJoinCodeInput.trim().toUpperCase()}`);
                  }
                }}
                disabled={syncJoinCodeInput.trim().length !== 6}
                className="w-full py-3 text-sm font-bold text-accent-start hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Follow
              </button>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="w-full py-3 text-sm font-bold text-accent-start hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. ADJUST PAGE PANEL ─────────────────────────────────────────── */}
      {isAdjustOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-72 bg-white dark:bg-[#1e1e24] border border-slate-300 dark:border-slate-700 shadow-2xl rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Crop size={16} className="text-accent-start" /> Adjust Font & Color
            </h3>
            <button
              onClick={() => setIsAdjustOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
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

          {/* Text Alignment Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Text Alignment</label>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {[
                { align: 'left', icon: AlignLeft, label: 'Left' },
                { align: 'center', icon: AlignCenter, label: 'Center' },
                { align: 'right', icon: AlignRight, label: 'Right' },
              ].map(({ align, icon: Icon, label }) => (
                <button
                  key={align}
                  onClick={() => {
                    const a = align as 'left' | 'center' | 'right';
                    setTextAlign(a);
                    localStorage.setItem('chord-grid-lyrics-align', a);
                  }}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-all ${
                    textAlign === align
                      ? 'bg-accent-gradient text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Color Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Text Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: 'Ink', color: '#0f172a' },
                { label: 'Indigo', color: '#4f46e5' },
                { label: 'Blue', color: '#2563eb' },
                { label: 'Purple', color: '#7c3aed' },
                { label: 'Rose', color: '#e11d48' },
                { label: 'Teal', color: '#0d9488' },
                { label: 'Amber', color: '#d97706' },
                { label: 'Slate', color: '#475569' },
              ].map(({ label, color }) => (
                <button
                  key={color}
                  title={label}
                  onClick={() => {
                    setTextColor(color);
                    localStorage.setItem('chord-grid-lyrics-color', color);
                  }}
                  className={`w-7 h-7 rounded-full border-2 transition-all active:scale-90 ${
                    textColor === color
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

      {/* ── 9. STANZAS / PARAGRAPHS OVERVIEW PANEL ──────────────────────── */}
      {isPageOverviewOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-80 bg-white dark:bg-[#1e1e24] border border-slate-300 dark:border-slate-700 shadow-2xl rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <LayoutGrid size={16} className="text-accent-start" /> Stanzas Overview
            </h3>
            <button
              onClick={() => setIsPageOverviewOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto p-1">
            {paragraphs.length === 0 ? (
              <p className="text-xs text-slate-400 p-2">No stanzas found.</p>
            ) : (
              paragraphs.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs truncate"
                >
                  <span className="font-bold text-accent-start mr-2">#{idx + 1}</span>
                  {p.slice(0, 40)}...
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 10. INFO PANEL ──────────────────────────────────────────────── */}
      {isInfoOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-72 bg-white dark:bg-[#1e1e24] border border-slate-300 dark:border-slate-700 shadow-2xl rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Info size={16} className="text-accent-start" /> Lyrics Details
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
              <span className="font-bold">{currentLyric.title || 'Untitled'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Stanzas:</span>
              <span className="font-bold">{paragraphs.length}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Last Modified:</span>
              <span className="font-mono text-[10px]">
                {currentLyric.updated_at
                  ? new Date(currentLyric.updated_at).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 11. SONG PICKER MODAL (Add Tab) ────────────────────────────── */}
      <SongPickerModal
        isOpen={isSongPickerOpen}
        onClose={() => setIsSongPickerOpen(false)}
        onAdd={handleAddPickedSongs}
        existingIds={tabs.map((t) => t.id)}
      />
    </div>
  );
}
