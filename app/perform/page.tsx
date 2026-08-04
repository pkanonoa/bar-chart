'use client';

import React, { useState, useEffect } from 'react';
import { searchAll } from '@/lib/storage';
import { Header } from '@/components/Header';
import {
  Play, Search, Plus, Trash2, CornerLeftUp, GripVertical, X,
  Save, BookOpen, ChevronRight, Music2, FolderOpen,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedSetlist {
  id: string;
  name: string;
  chartIds: string[];
  savedAt: string;
}

interface QueueItem {
  id: string;
  title: string;
  meta: string;
}

const SETLISTS_KEY = 'chord-grid-perform-setlists';

function loadSavedSetlists(): SavedSetlist[] {
  try {
    return JSON.parse(localStorage.getItem(SETLISTS_KEY) || '[]');
  } catch { return []; }
}

function persistSetlists(lists: SavedSetlist[]) {
  localStorage.setItem(SETLISTS_KEY, JSON.stringify(lists));
}

function generateCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

function SortableItem({ id, idx, item, onRemove }: { id: string; idx: number; item: QueueItem; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', opacity: isDragging ? 0.7 : 1 }}
      className="flex items-center justify-between p-3 sm:p-4 bg-surface border border-border rounded-xl shadow-sm group"
    >
      <div className="flex items-center space-x-3 overflow-hidden flex-1">
        <div {...attributes} {...listeners} className="p-2 -ml-2 text-text-secondary cursor-grab active:cursor-grabbing hover:text-white shrink-0 touch-none">
          <GripVertical size={20} />
        </div>
        <div className="w-9 h-9 bg-accent-gradient rounded-full flex items-center justify-center shadow-md shrink-0">
          <span className="text-white font-bold text-xs">{idx + 1}</span>
        </div>
        <div className="truncate">
          <p className="text-sm font-bold text-text-primary truncate">{item.title}</p>
          <p className="text-[10px] text-text-secondary">{item.meta}</p>
        </div>
      </div>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRemove(id); }}
        className="p-2 text-text-secondary hover:text-red-400 transition-colors z-10 relative shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PerformPage() {
  const router = useRouter();

  // Queue of { id, title, meta }
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [setlistName, setSetlistName] = useState('My Setlist');
  const [savedSetlists, setSavedSetlists] = useState<SavedSetlist[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Join session
  const [joinCode, setJoinCode] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setSavedSetlists(loadSavedSetlists());
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    const t = setTimeout(async () => {
      const res = await searchAll(searchQuery);
      if (!searchQuery.trim()) return;
      setSearchResults(res.filter(r => r.type === 'chart'));
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const addChart = (chart: any) => {
    if (queue.some(q => q.id === chart.id)) return;
    setQueue(prev => [...prev, {
      id: chart.id,
      title: chart.title || 'Untitled',
      meta: chart.time_sig ? `${chart.time_sig} · t=${chart.tempo}` : '',
    }]);
  };

  const removeChart = (id: string) => setQueue(prev => prev.filter(q => q.id !== id));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = queue.findIndex(q => q.id === active.id);
      const newIdx = queue.findIndex(q => q.id === over.id);
      setQueue(prev => arrayMove(prev, oldIdx, newIdx));
    }
  };

  const handleSaveSetlist = () => {
    if (!queue.length) return;
    const newList: SavedSetlist = {
      id: crypto.randomUUID(),
      name: setlistName || 'Untitled Setlist',
      chartIds: queue.map(q => q.id),
      savedAt: new Date().toISOString(),
    };
    const updated = [newList, ...savedSetlists];
    setSavedSetlists(updated);
    persistSetlists(updated);
  };

  const handleLoadSetlist = async (sl: SavedSetlist) => {
    // We stored only IDs — fetch titles from search index
    const items: QueueItem[] = sl.chartIds.map(id => ({ id, title: 'Loading...', meta: '' }));
    setQueue(items);
    setSetlistName(sl.name);
    setShowSaved(false);

    // Enrich titles asynchronously
    const results = await searchAll('');
    const byId = Object.fromEntries(results.map((r: any) => [r.id, r]));
    setQueue(sl.chartIds.map(id => ({
      id,
      title: byId[id]?.title || 'Unknown',
      meta: byId[id]?.time_sig ? `${byId[id].time_sig} · t=${byId[id].tempo}` : '',
    })));
  };

  const handleDeleteSaved = (id: string) => {
    const updated = savedSetlists.filter(s => s.id !== id);
    setSavedSetlists(updated);
    persistSetlists(updated);
  };

  const handleStartSession = () => {
    if (!queue.length) return;
    const code = generateCode();
    sessionStorage.setItem(
      `perform-leader-${code}`,
      JSON.stringify({ chartIds: queue.map(q => q.id), sessionName: setlistName }),
    );
    router.push(`/perform/${code}`);
  };

  const handleJoin = () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length === 6) router.push(`/perform/${c}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto px-4 pt-[max(env(safe-area-inset-top,2rem),2rem)] pb-32">



        {/* ── Search ── */}
        <div className="relative mb-6 z-20">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search size={18} className="text-text-secondary" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-surface border border-border rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-solid transition-all font-medium shadow-inner"
            placeholder="Search charts to add…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
          />
          {isSearchFocused && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-surface-raised border border-border rounded-2xl shadow-popover max-h-72 overflow-y-auto p-2 space-y-1 z-30">
              {isSearching && <div className="p-4 text-center text-text-secondary text-sm">Searching…</div>}
              {!isSearching && searchResults.length === 0 && <div className="p-4 text-center text-text-secondary text-sm">No charts found.</div>}
              {searchResults.map(chart => {
                const inQueue = queue.some(q => q.id === chart.id);
                return (
                  <div key={chart.id} onClick={() => !inQueue && addChart(chart)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all group ${!inQueue ? 'cursor-pointer hover:bg-white/5' : 'opacity-60'}`}>
                    <div className="truncate pr-4">
                      <p className="text-sm font-bold text-text-primary truncate group-hover:text-accent-start transition-colors">{chart.title}</p>
                      <p className="text-[10px] text-text-secondary">{chart.time_sig} · t={chart.tempo}</p>
                    </div>
                    <button disabled={inQueue}
                      className={`shrink-0 p-2 rounded-lg flex items-center text-xs font-bold transition-colors ${inQueue ? 'text-text-secondary cursor-not-allowed' : 'text-accent-start hover:bg-accent-start/10'}`}>
                      {inQueue ? 'Added' : <><Plus size={14} className="mr-1" /> Add</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {isSearchFocused && searchQuery.trim() && <div className="fixed inset-0 z-10" onClick={() => setIsSearchFocused(false)} />}

        {/* ── Queue ── */}
        <div className="bg-surface border border-border rounded-3xl p-6 shadow-card mb-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Music2 size={16} className="text-accent-start" />
              Setlist ({queue.length})
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={handleSaveSetlist} disabled={!queue.length}
                className="flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-accent-start px-3 py-1.5 bg-surface-raised border border-border rounded-lg transition-all disabled:opacity-40">
                <Save size={12} /> Save
              </button>
              <button onClick={() => setShowSaved(!showSaved)}
                className="flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-accent-start px-3 py-1.5 bg-surface-raised border border-border rounded-lg transition-all">
                <BookOpen size={12} /> Saved ({savedSetlists.length})
              </button>
            </div>
          </div>

          {/* Saved setlists panel */}
          {showSaved && (
            <div className="mb-5 space-y-2">
              {savedSetlists.length === 0 && (
                <div className="text-center text-text-secondary text-xs py-4">No saved setlists yet.</div>
              )}
              {savedSetlists.map(sl => (
                <div key={sl.id} className="flex items-center justify-between p-3 bg-surface-raised rounded-xl border border-border group">
                  <div className="truncate flex-1">
                    <p className="text-sm font-bold text-text-primary truncate">{sl.name}</p>
                    <p className="text-[10px] text-text-secondary">{sl.chartIds.length} charts · {new Date(sl.savedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    <button onClick={() => handleLoadSetlist(sl)}
                      className="text-xs font-bold text-accent-start hover:text-accent-start/80 px-2 py-1 bg-accent-start/10 rounded-lg transition-all">
                      <FolderOpen size={14} />
                    </button>
                    <button onClick={() => handleDeleteSaved(sl.id)} className="text-xs text-text-secondary hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {queue.length === 0 ? (
            <div className="py-12 text-center bg-surface-raised border border-dashed border-border rounded-2xl">
              <Music2 size={32} className="text-text-secondary mx-auto mb-3 opacity-50" />
              <p className="text-text-secondary text-sm">Search for charts above to build your setlist.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={queue.map(q => q.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {queue.map((item, idx) => (
                    <SortableItem key={item.id} id={item.id} idx={idx} item={item} onRemove={removeChart} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* ── Start Session ── */}
        <button
          onClick={handleStartSession}
          disabled={queue.length === 0}
          className="w-full py-5 bg-accent-gradient text-white text-lg font-bold rounded-2xl shadow-popover hover:brightness-110 transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={22} fill="white" /> Start Session
        </button>
        <p className="text-center text-xs text-text-secondary mt-3 font-medium">
          A 6-character code will be generated for others to join.
        </p>
      </main>
    </div>
  );
}
