'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import {
  listSetlistItems, addSetlistItems, updateSetlistItem,
  removeSetlistItem, reorderSetlistItems, updateSetlist,
  type SetlistItem, type Setlist,
} from '@/lib/setlists';
import { readChart, readLyrics } from '@/lib/storage';
import { ChartRenderer } from '@/components/ChartRenderer';
import { SongPickerModal, type PickedItem } from '@/components/SongPickerModal';
import { transposeChart } from '@/lib/transpose';
import { ChartData } from '@/lib/chart-types';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import {
  GripVertical, Plus, Printer, Play, MoreVertical, Trash2, Pencil,
  FileText, Music, CornerLeftUp, X, Minus, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Transpose Stepper Modal ──────────────────────────────────────────────────

function TransposeModal({ item, onClose, onSave }: {
  item: SetlistItem;
  onClose: () => void;
  onSave: (val: number | null) => void;
}) {
  const [val, setVal] = useState<number>(item.transpose_override ?? 0);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xs bg-surface border border-border rounded-2xl shadow-popover p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Setlist Transpose</h3>
          <p className="text-[10px] text-text-secondary mt-0.5">
            Applied only within this setlist — doesn't change the original chart.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setVal(v => v - 1)}
            className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-text-primary hover:bg-white/10 transition-all"
          >
            <Minus size={18} />
          </button>
          <span className="text-3xl font-bold text-text-primary w-16 text-center">
            {val > 0 ? `+${val}` : val}
          </span>
          <button
            onClick={() => setVal(v => v + 1)}
            className="w-10 h-10 rounded-xl bg-surface-raised border border-border flex items-center justify-center text-text-primary hover:bg-white/10 transition-all"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onSave(null)}
            className="flex-1 py-2 text-xs font-bold text-text-secondary bg-surface-raised border border-border rounded-xl hover:text-white transition-all"
          >
            Reset
          </button>
          <button
            onClick={() => onSave(val)}
            className="flex-1 py-2 text-xs font-bold text-white bg-accent-gradient rounded-xl hover:brightness-110 transition-all"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Note Edit Modal ──────────────────────────────────────────────────────────

function NoteModal({ item, onClose, onSave }: {
  item: SetlistItem;
  onClose: () => void;
  onSave: (note: string | null) => void;
}) {
  const [note, setNote] = useState(item.notes ?? '');

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-surface border border-border rounded-2xl shadow-popover p-5 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-text-primary">Item Note</h3>
        <textarea
          autoFocus
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          placeholder="Capo 2, slow count-in, skip intro…"
          className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-text-primary placeholder-text-secondary outline-none focus:border-accent-solid transition-all resize-none"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-xs font-bold text-text-secondary bg-surface-raised border border-border rounded-xl hover:text-white transition-all">
            Cancel
          </button>
          <button
            onClick={() => onSave(note.trim() || null)}
            className="flex-1 py-2 text-xs font-bold text-white bg-accent-gradient rounded-xl hover:brightness-110 transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────

function SortableItemRow({
  item, idx, onSetTranspose, onSetNote, onRemove,
}: {
  item: SetlistItem;
  idx: number;
  onSetTranspose: (item: SetlistItem) => void;
  onSetNote: (item: SetlistItem) => void;
  onRemove: (item: SetlistItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [menuOpen, setMenuOpen] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 sm:p-4 bg-surface border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow group">
      {/* Drag handle */}
      <div {...attributes} {...listeners} className="p-1.5 -ml-1 text-text-secondary cursor-grab active:cursor-grabbing hover:text-white touch-none shrink-0">
        <GripVertical size={18} />
      </div>

      {/* Position */}
      <div className="w-8 h-8 rounded-full bg-accent-gradient flex items-center justify-center text-white font-bold text-xs shrink-0">
        {idx + 1}
      </div>

      {/* Type icon */}
      <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center shrink-0">
        {item.item_type === 'chart'
          ? <FileText size={14} className="text-accent-start" />
          : <Music size={14} className="text-accent-end" />
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text-primary truncate">{item.title || 'Untitled'}</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {item.transpose_override !== null && item.transpose_override !== undefined && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-accent-gradient/15 text-accent-start border border-accent-solid/20">
              {item.transpose_override > 0 ? `+${item.transpose_override}` : item.transpose_override} semitones
            </span>
          )}
          {item.notes && (
            <span className="text-[10px] italic text-text-secondary truncate max-w-[200px]">
              {item.notes}
            </span>
          )}
        </div>
      </div>

      {/* Menu */}
      <div className="relative shrink-0">
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          className="p-2 text-text-secondary hover:text-white bg-surface-raised border border-border rounded-xl opacity-0 group-hover:opacity-100 transition-all"
        >
          <MoreVertical size={15} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 min-w-[160px] bg-surface-raised border border-border rounded-xl shadow-popover overflow-hidden">
              {item.item_type === 'chart' && (
                <button
                  onClick={() => { setMenuOpen(false); onSetTranspose(item); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-white/5 transition-all"
                >
                  <Pencil size={13} className="text-accent-start" /> Set transpose
                </button>
              )}
              <button
                onClick={() => { setMenuOpen(false); onSetNote(item); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-white/5 transition-all"
              >
                <Pencil size={13} /> {item.notes ? 'Edit note' : 'Add note'}
              </button>
              <div className="h-px bg-border mx-2" />
              <button
                onClick={() => { setMenuOpen(false); onRemove(item); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 size={13} /> Remove from setlist
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Print View ───────────────────────────────────────────────────────────────

function PrintView({ setlist, items, charts, lyricsMap }: {
  setlist: Setlist;
  items: SetlistItem[];
  charts: Record<string, ChartData>;
  lyricsMap: Record<string, any>;
}) {
  return (
    <div className="print-only">
      {/* Cover page */}
      <div className="page-break-after min-h-screen flex flex-col justify-center px-16 py-24">
        <h1 className="text-5xl font-bold mb-3">{setlist.name}</h1>
        {setlist.date && (
          <p className="text-2xl text-gray-600 mb-2">
            {new Date(setlist.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        {setlist.notes && <p className="text-base text-gray-500 mt-2 mb-8">{setlist.notes}</p>}

        <div className="mt-12 border-t border-gray-200 pt-8">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Contents</p>
          <ol className="space-y-2">
            {items.map((item, i) => (
              <li key={item.id} className="flex items-center gap-3 text-base">
                <span className="w-7 text-right font-bold text-gray-400">{i + 1}.</span>
                <span className="font-semibold">{item.title}</span>
                <span className="text-xs text-gray-400">({item.item_type === 'chart' ? 'Chart' : 'Lyrics'})</span>
                {item.transpose_override !== null && item.transpose_override !== undefined && item.item_type === 'chart' && (
                  <span className="text-xs text-gray-500 ml-auto">
                    Transpose: {item.transpose_override > 0 ? '+' : ''}{item.transpose_override}
                  </span>
                )}
                {item.notes && (
                  <span className="text-xs italic text-gray-400 ml-auto">{item.notes}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* One page per item */}
      {items.map((item, i) => {
        if (item.item_type === 'chart') {
          let chart = charts[item.item_id];
          if (!chart) return null;
          if (item.transpose_override) {
            chart = transposeChart(chart, item.transpose_override, chart.prefer_flats);
          }
          return (
            <div key={item.id} className={i < items.length - 1 ? 'page-break' : ''}>
              {item.notes && (
                <div className="px-8 pt-6 text-sm italic text-gray-500">Note: {item.notes}</div>
              )}
              <ChartRenderer chart={chart} />
            </div>
          );
        } else {
          const lyr = lyricsMap[item.item_id];
          if (!lyr) return null;
          return (
            <div key={item.id} className={`${i < items.length - 1 ? 'page-break' : ''} px-8 py-12`}>
              <h1 className="text-4xl font-bold mb-8 border-b border-gray-200 pb-4">{lyr.title}</h1>
              {item.notes && <p className="text-sm italic text-gray-500 mb-4">Note: {item.notes}</p>}
              <pre className="font-sans text-base leading-relaxed whitespace-pre-wrap">{lyr.body}</pre>
            </div>
          );
        }
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SetlistDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const setlistId = params.id as string;

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [items, setItems] = useState<SetlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active tab (selected song index)
  const [activeTab, setActiveTab] = useState(0);
  const [tabChart, setTabChart] = useState<ChartData | null>(null);
  const [tabLyrics, setTabLyrics] = useState<any>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Print data
  const [printCharts, setPrintCharts] = useState<Record<string, ChartData>>({});
  const [printLyrics, setPrintLyricsMap] = useState<Record<string, any>>({});

  // Modals
  const [showPicker, setShowPicker] = useState(false);
  const [transposeTarget, setTransposeTarget] = useState<SetlistItem | null>(null);
  const [noteTarget, setNoteTarget] = useState<SetlistItem | null>(null);

  // Inline edit
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [editingDate, setEditingDate] = useState(false);
  const [dateVal, setDateVal] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: sl } = await supabase.from('setlists').select('*').eq('id', setlistId).single();
      if (!sl) { router.push('/setlists'); return; }
      setSetlist(sl);
      setNameVal(sl.name);
      setDateVal(sl.date || '');
      const loaded = await listSetlistItems(setlistId);
      setItems(loaded);
    } finally {
      setLoading(false);
    }
  }, [setlistId, router]);

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);

  // Load content for the active tab
  useEffect(() => {
    if (items.length === 0) return;
    const item = items[activeTab] || items[0];
    if (!item) return;
    setTabChart(null);
    setTabLyrics(null);
    setTabLoading(true);
    if (item.item_type === 'chart') {
      readChart(item.item_id).then(chart => {
        if (chart) {
          let display = chart as ChartData;
          if (item.transpose_override) display = transposeChart(display, item.transpose_override, display.prefer_flats);
          setTabChart(display);
        }
        setTabLoading(false);
      });
    } else {
      readLyrics(item.item_id).then(lyr => {
        setTabLyrics(lyr);
        setTabLoading(false);
      });
    }
  }, [activeTab, items]);

  // Pre-load print data whenever items change
  useEffect(() => {
    const chartItems = items.filter(i => i.item_type === 'chart');
    const lyricsItems = items.filter(i => i.item_type === 'lyrics');

    chartItems.forEach(async item => {
      const chart = await readChart(item.item_id);
      if (chart) setPrintCharts(prev => ({ ...prev, [item.item_id]: chart as ChartData }));
    });
    lyricsItems.forEach(async item => {
      const lyr = await readLyrics(item.item_id);
      if (lyr) setPrintLyricsMap(prev => ({ ...prev, [item.item_id]: lyr }));
    });
  }, [items]);

  // Drag and drop
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex(i => i.id === active.id);
    const newIdx = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIdx, newIdx).map((item, pos) => ({ ...item, position: pos }));
    setItems(reordered);
    await reorderSetlistItems(reordered.map(i => ({ id: i.id, position: i.position })));
  };

  const handleAddSongs = async (picked: PickedItem[]) => {
    const startPos = items.length;
    const added = await addSetlistItems(
      setlistId,
      picked.map(p => ({ item_type: p.item_type, item_id: p.item_id })),
      startPos,
    );
    // Enrich with titles
    const enriched: SetlistItem[] = added.map((a: any) => {
      const source = picked.find(p => p.item_id === a.item_id);
      return { ...a, title: source?.title || 'Unknown' };
    });
    setItems(prev => [...prev, ...enriched]);
  };

  const handleTransposeSave = async (val: number | null) => {
    if (!transposeTarget) return;
    await updateSetlistItem(transposeTarget.id, { transpose_override: val });
    setItems(prev => prev.map(i => i.id === transposeTarget.id ? { ...i, transpose_override: val } : i));
    setTransposeTarget(null);
  };

  const handleNoteSave = async (note: string | null) => {
    if (!noteTarget) return;
    await updateSetlistItem(noteTarget.id, { notes: note });
    setItems(prev => prev.map(i => i.id === noteTarget.id ? { ...i, notes: note } : i));
    setNoteTarget(null);
  };

  const handleRemove = async (item: SetlistItem) => {
    await removeSetlistItem(item.id, setlistId);
    setItems(prev => {
      const next = prev.filter(i => i.id !== item.id);
      setActiveTab(t => Math.min(t, Math.max(0, next.length - 1)));
      return next;
    });
  };

  const handleNameSave = async () => {
    if (!nameVal.trim() || !setlist) return;
    await updateSetlist(setlist.id, { name: nameVal.trim() });
    setSetlist(s => s ? { ...s, name: nameVal.trim() } : s);
    setEditingName(false);
  };

  const handleDateSave = async () => {
    if (!setlist) return;
    await updateSetlist(setlist.id, { date: dateVal || null });
    setSetlist(s => s ? { ...s, date: dateVal || null } : s);
    setEditingDate(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-accent-start border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!setlist) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-[max(env(safe-area-inset-top,2rem),2rem)] pb-32">

        {/* Page header */}
        <div className="flex items-start gap-3 mb-8 mt-4">
          <button
            onClick={() => router.push('/setlists')}
            className="p-3 text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all shrink-0 mt-1"
          >
            <CornerLeftUp size={20} />
          </button>

          <div className="flex-1 min-w-0">
            {/* Editable name */}
            {editingName ? (
              <input
                autoFocus
                value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={e => e.key === 'Enter' && handleNameSave()}
                className="text-2xl sm:text-3xl font-bold text-text-primary bg-transparent border-b-2 border-accent-solid outline-none w-full"
              />
            ) : (
              <h1
                className="text-2xl sm:text-3xl font-bold text-text-primary cursor-pointer hover:text-accent-start transition-all truncate"
                onClick={() => setEditingName(true)}
                title="Click to edit name"
              >
                {setlist.name}
              </h1>
            )}

            {/* Editable date */}
            {editingDate ? (
              <input
                autoFocus
                type="date"
                value={dateVal}
                onChange={e => setDateVal(e.target.value)}
                onBlur={handleDateSave}
                className="text-xs text-text-secondary bg-transparent border-b border-border outline-none mt-1"
              />
            ) : (
              <p
                className="text-xs text-text-secondary mt-1 cursor-pointer hover:text-accent-start transition-all"
                onClick={() => setEditingDate(true)}
                title="Click to edit date"
              >
                {setlist.date
                  ? new Date(setlist.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                  : '+ Add date'}
              </p>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border text-text-primary text-sm font-bold rounded-xl hover:bg-surface-raised hover:text-accent-start transition-all"
          >
            <Plus size={16} /> Add songs
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border text-text-primary text-sm font-bold rounded-xl hover:bg-surface-raised hover:text-accent-start transition-all"
          >
            <Printer size={16} /> Print setlist
          </button>
          <button
            disabled={items.length === 0}
            onClick={() => {
              sessionStorage.setItem(`setlist-leader-${setlistId}`, '1');
              router.push(`/setlists/${setlistId}/perform`);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-gradient text-white text-sm font-bold rounded-xl shadow-md hover:brightness-110 disabled:opacity-40 transition-all ml-auto"
          >
            <Play size={16} /> Start set
          </button>
        </div>

        {/* Song tabs + preview */}
        {items.length === 0 ? (
          <div className="text-center py-20 text-text-secondary border border-dashed border-border rounded-2xl">
            <Music size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No songs yet</p>
            <p className="text-sm opacity-70 mt-1">Tap "+ Add songs" to build your setlist.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* ── Tab strip ────────────────────────────────────────── */}
            <div className="relative">
              {/* Scroll container */}
              <div
                ref={tabsScrollRef}
                className="flex items-end overflow-x-auto gap-1 px-1 pb-0"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {items.map((item, idx) => {
                  const active = idx === activeTab;
                  const Icon = item.item_type === 'chart' ? FileText : Music;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(idx)}
                      className={`
                        relative flex items-center gap-1.5 px-3 py-2 text-xs font-bold
                        rounded-t-xl border border-b-0 transition-all duration-150
                        whitespace-nowrap shrink-0 max-w-[160px]
                        ${ active
                          ? 'bg-surface border-border text-text-primary shadow-[0_-2px_10px_rgba(0,0,0,0.3)] z-10 -mb-px pb-[calc(0.5rem+1px)]'
                          : 'bg-surface/40 border-transparent text-text-secondary hover:text-text-primary hover:bg-surface/70'
                        }
                      `}
                    >
                      {/* Top accent line on active */}
                      {active && (
                        <span className="absolute top-0 left-2 right-2 h-[2px] rounded-full bg-accent-gradient" />
                      )}
                      <span className="text-[9px] font-black opacity-50 shrink-0">{idx + 1}</span>
                      <Icon size={11} className={active ? 'text-accent-start shrink-0' : 'shrink-0'} />
                      <span className="truncate">{item.title || 'Untitled'}</span>
                      {item.transpose_override !== null && item.transpose_override !== undefined && item.item_type === 'chart' && (
                        <span className="text-[8px] font-black px-1 py-0.5 rounded bg-accent-gradient/20 text-accent-start shrink-0">
                          {item.transpose_override > 0 ? '+' : ''}{item.transpose_override}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Bottom border connecting tab row to panel */}
              <div className="h-px bg-border" />
            </div>

            {/* ── Preview panel ─────────────────────────────────────── */}
            <div className="bg-surface border border-t-0 border-border rounded-b-2xl overflow-hidden">
              {/* Panel toolbar */}
              {(() => {
                const item = items[activeTab];
                if (!item) return null;
                return (
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-raised/50">
                    <div className="flex items-center gap-2">
                      {/* Prev / Next */}
                      <button
                        onClick={() => setActiveTab(t => Math.max(0, t - 1))}
                        disabled={activeTab === 0}
                        className="p-1 text-text-secondary hover:text-white disabled:opacity-30 transition-all"
                      ><ChevronLeft size={16} /></button>
                      <span className="text-xs text-text-secondary font-bold">
                        {activeTab + 1} / {items.length}
                      </span>
                      <button
                        onClick={() => setActiveTab(t => Math.min(items.length - 1, t + 1))}
                        disabled={activeTab === items.length - 1}
                        className="p-1 text-text-secondary hover:text-white disabled:opacity-30 transition-all"
                      ><ChevronRight size={16} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.notes && (
                        <span className="text-[10px] italic text-text-secondary hidden sm:block">{item.notes}</span>
                      )}
                      {item.transpose_override !== null && item.transpose_override !== undefined && item.item_type === 'chart' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-gradient/15 text-accent-start border border-accent-solid/20">
                          Setlist: {item.transpose_override > 0 ? '+' : ''}{item.transpose_override}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          if (item.item_type === 'chart') setTransposeTarget(item);
                          else setNoteTarget(item);
                        }}
                        className="p-1.5 text-text-secondary hover:text-white bg-surface border border-border rounded-lg transition-all"
                      ><Pencil size={13} /></button>
                      <button
                        onClick={() => handleRemove(item)}
                        className="p-1.5 text-red-400 hover:text-red-300 bg-surface border border-border rounded-lg transition-all"
                      ><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })()}

              {/* Content area */}
              <div className="min-h-[320px] max-h-[55vh] overflow-auto relative">
                {tabLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-7 h-7 rounded-full border-2 border-accent-start border-t-transparent animate-spin" />
                  </div>
                )}

                {!tabLoading && tabChart && (
                  <div className="p-4 overflow-auto">
                    <ChartRenderer chart={tabChart} />
                  </div>
                )}

                {!tabLoading && tabLyrics && (
                  <div className="p-6">
                    <h2 className="text-xl font-bold text-text-primary mb-4">{tabLyrics.title}</h2>
                    <pre className="font-sans text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{tabLyrics.body}</pre>
                  </div>
                )}
              </div>
            </div>

            {/* ── Reorder list (collapsed below preview) ──────────── */}
            <div className="mt-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-2 px-1">Order (drag to reorder)</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2">
                    {items.map((item, idx) => (
                      <SortableItemRow
                        key={item.id}
                        item={item}
                        idx={idx}
                        onSetTranspose={setTransposeTarget}
                        onSetNote={setNoteTarget}
                        onRemove={handleRemove}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showPicker && (
        <SongPickerModal
          isOpen={showPicker}
          onClose={() => setShowPicker(false)}
          onAdd={handleAddSongs}
          existingIds={items.map(i => i.item_id)}
        />
      )}
      {transposeTarget && (
        <TransposeModal
          item={transposeTarget}
          onClose={() => setTransposeTarget(null)}
          onSave={handleTransposeSave}
        />
      )}
      {noteTarget && (
        <NoteModal
          item={noteTarget}
          onClose={() => setNoteTarget(null)}
          onSave={handleNoteSave}
        />
      )}

      {/* Hidden print view */}
      <PrintView
        setlist={setlist}
        items={items}
        charts={printCharts}
        lyricsMap={printLyrics}
      />
    </div>
  );
}
