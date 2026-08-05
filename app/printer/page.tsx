'use client';

import React, { useState, useEffect } from 'react';
import { readChart, searchAll, Chart } from '@/lib/storage';
import { ChartRenderer } from '@/components/ChartRenderer';
import { Header } from '@/components/Header';
import { Printer, Search, Plus, Trash2, ArrowUp, ArrowDown, FileText, CornerLeftUp, GripVertical, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id, idx, chart, onRemove }: { id: string, idx: number, chart: Chart | undefined, onRemove: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center justify-between p-3 sm:p-4 bg-surface border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow group"
    >
      <div className="flex items-center space-x-3 overflow-hidden flex-1">
        {/* Drag handle */}
        <div {...attributes} {...listeners} className="p-2 -ml-2 text-text-secondary cursor-grab active:cursor-grabbing hover:text-white shrink-0 touch-none">
          <GripVertical size={20} />
        </div>
        <div className="w-10 h-10 bg-surface-raised rounded-full flex items-center justify-center shadow-inner border border-border shrink-0">
          <span className="text-accent-start font-bold text-xs">{idx + 1}</span>
        </div>
        <div className="truncate">
          <p className="text-sm font-bold text-text-primary truncate">{chart ? chart.title : 'Loading...'}</p>
          <p className="text-[10px] text-text-secondary">{chart ? chart.time_sig + ' • t=' + chart.tempo : '...'}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2 shrink-0 pl-2">
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemove(id); }} 
          className="p-2 text-red-400 hover:text-red-300 z-10 relative"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

export default function PrinterPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<string[]>([]);
  const [charts, setCharts] = useState<Record<string, Chart>>({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [font, setFont] = useState('system');
  const [setlistName, setSetlistName] = useState('My Setlist');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [watermark, setWatermark] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const q = JSON.parse(localStorage.getItem('chord-grid-print-queue') || '[]');
    setQueue(q);
    
    const savedFont = localStorage.getItem('chord-grid-font');
    if (savedFont) setFont(savedFont);

    const savedWatermark = localStorage.getItem('chord-grid-watermark');
    if (savedWatermark) setWatermark(savedWatermark);
  }, []);

  useEffect(() => {
    const loadCharts = async () => {
      const newCharts = { ...charts };
      for (const id of queue) {
        if (!newCharts[id]) {
          const c = await readChart(id);
          if (c) newCharts[id] = c as Chart;
        }
      }
      setCharts(newCharts);
    };
    loadCharts();
  }, [queue]);

  useEffect(() => {
    const doSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      const results = await searchAll(searchQuery);
      const chartResults = results.filter(r => r.type === 'chart');
      setSearchResults(chartResults);
    };
    const t = setTimeout(doSearch, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const updateQueue = (newQ: string[]) => {
    setQueue(newQ);
    localStorage.setItem('chord-grid-print-queue', JSON.stringify(newQ));
  };

  const addChart = (id: string) => {
    if (queue.includes(id)) return;
    updateQueue([...queue, id]);
  };

  const removeChart = (id: string) => {
    updateQueue(queue.filter(item => item !== id));
  };

  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = queue.indexOf(active.id);
      const newIndex = queue.indexOf(over.id);
      updateQueue(arrayMove(queue, oldIndex, newIndex));
    }
  }

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = setlistName || 'Setlist';
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
    setIsPrintModalOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col print:min-h-0 print:block w-full print:w-full print:m-0 print:p-0">
      <div className="print:hidden">
        <Header />
      </div>
      <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto px-4 pt-[max(env(safe-area-inset-top,2rem),2rem)] pb-24 print:hidden">
        <div className="print:hidden mb-8">

        {/* Search bar and print options button side-by-side */}
        <div className="relative flex items-center gap-3 w-full mb-8 z-20">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-text-secondary" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-3 bg-surface border border-border rounded-xl leading-5 text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-solid transition-all font-medium shadow-inner"
              placeholder="Search all charts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
            />

            {/* Floating Dropdown Results */}
            {isSearchFocused && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-surface-raised border border-border rounded-2xl shadow-popover max-h-72 overflow-y-auto p-2 space-y-1 z-30">
                {isSearching && searchResults.length === 0 && (
                  <div className="p-4 text-center text-text-secondary text-sm">Searching...</div>
                )}
                {!isSearching && searchResults.length === 0 && (
                  <div className="p-4 text-center text-text-secondary text-sm">No charts found.</div>
                )}
                {searchResults.map((chart) => {
                  const inQueue = queue.includes(chart.id);
                  return (
                    <div 
                      key={chart.id} 
                      onClick={() => !inQueue && addChart(chart.id)}
                      className={`flex items-center justify-between p-3 rounded-xl transition-all group ${!inQueue ? 'cursor-pointer hover:bg-white/5 border border-transparent' : 'opacity-70'}`}
                    >
                      <div className="truncate pr-4">
                        <p className="text-sm font-bold text-text-primary truncate group-hover:text-accent-start transition-colors">{chart.title}</p>
                        <p className="text-[10px] text-text-secondary truncate">{chart.path}</p>
                      </div>
                      <button
                        disabled={inQueue}
                        onClick={(e) => { e.stopPropagation(); if (!inQueue) addChart(chart.id); }}
                        className={`shrink-0 p-2 rounded-lg flex items-center text-xs font-bold transition-colors ${inQueue ? 'text-text-secondary bg-surface cursor-not-allowed' : 'text-accent-start hover:bg-accent-start/10'}`}
                      >
                        {inQueue ? 'Added' : <><Plus size={14} className="mr-1" /> Add</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsPrintModalOpen(true)}
            disabled={queue.length === 0}
            className="px-4 sm:px-6 py-3 bg-accent-gradient rounded-xl text-white shadow-md hover:brightness-110 transition-all flex items-center justify-center font-bold text-sm disabled:opacity-50 whitespace-nowrap h-[46px]"
          >
            <Printer size={18} className="sm:mr-2" />
            <span className="hidden sm:inline">Print Options...</span>
          </button>
        </div>

        {/* Click-away overlay to dismiss search popup */}
        {isSearchFocused && searchQuery.trim() && (
          <div className="fixed inset-0 z-10" onClick={() => setIsSearchFocused(false)} />
        )}

        <div className="w-full">
          {/* Queue Management */}
          <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-card">
            <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center pb-4 border-b border-border">
              <FileText size={20} className="mr-3 text-accent-start" /> Your Print Queue ({queue.length})
            </h2>
            
            {queue.length === 0 ? (
              <div className="p-8 text-center bg-surface-raised border border-dashed border-border rounded-2xl">
                <p className="text-text-secondary text-sm">Your queue is empty. Search for charts above to build your setlist.</p>
              </div>
            ) : (
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={queue}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {queue.map((id, idx) => (
                      <SortableItem key={id} id={id} idx={idx} chart={charts[id]} onRemove={removeChart} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:hidden">
          <div className="bg-surface border border-border p-6 rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Print Options</h3>
              <button onClick={() => setIsPrintModalOpen(false)} className="text-text-secondary hover:text-white"><X size={20} /></button>
            </div>
            <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider">Setlist Name</label>
            <input 
              value={setlistName}
              onChange={(e) => setSetlistName(e.target.value)}
              className="w-full mb-6 p-3 bg-surface-raised border border-border rounded-xl outline-none focus:border-accent-solid"
            />
            <button 
              onClick={handlePrint}
              className="w-full py-3 bg-accent-gradient rounded-xl text-white font-bold hover:brightness-110 transition-all"
            >
              Print
            </button>
          </div>
        </div>
      )}

      </main>

      {/* Hidden Print Container - outside scrollable main wrapper to prevent clipping */}
      <div className="hidden print:block w-full max-w-none m-0 p-0 overflow-visible text-black">
        {queue.length > 0 && (
          <div className="page-break-after w-[min(100%,60rem)] mx-auto px-12 pt-20 pb-16 text-black block">
            <h1 className="text-4xl sm:text-5xl font-extrabold print:!font-bold tracking-normal text-black mb-3">
              {setlistName || 'Setlist Print Queue'}
            </h1>
            <p className="text-xl font-medium text-slate-700 print:text-black mb-8">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <div className="mt-8 border-t-2 border-slate-300 print:border-black pt-8">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-700 print:text-black mb-6">Setlist Contents ({queue.length} Songs)</p>
              <ol className="space-y-4">
                {queue.map((id, idx) => {
                  const chart = charts[id];
                  return (
                    <li key={id} className="flex items-baseline justify-between gap-4 pb-3 border-b border-slate-200 print:border-slate-300 text-lg print:text-base text-black">
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className="w-8 shrink-0 text-right font-mono font-bold text-slate-700 print:text-black">{idx + 1}.</span>
                        <span className="font-bold tracking-tight print:!tracking-normal text-black text-xl print:text-lg">{chart ? chart.title : 'Unknown Song'}</span>
                        <span className="text-xs font-semibold text-slate-600 print:text-slate-800 uppercase tracking-wider px-2 py-0.5 bg-slate-100 print:bg-transparent rounded">
                          Chart
                        </span>
                      </div>
                      {chart && (
                        <div className="flex items-baseline gap-4 shrink-0 text-sm font-mono font-bold text-slate-700 print:text-black">
                          {chart.time_sig || '4/4'} • t={chart.tempo || 120}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}

        {queue.map((id, index) => {
          const chart = charts[id];
          if (!chart) return null;
          return (
            <div key={id} className="page-break print:break-before-page w-full max-w-none overflow-visible pt-4">
              <ChartRenderer chart={chart as any} selectedFont={font} watermark={watermark} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
