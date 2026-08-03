'use client';

import React, { useState, useEffect } from 'react';
import { readChart, searchAll, Chart } from '@/lib/storage';
import { ChartRenderer } from '@/components/ChartRenderer';
import { Printer, Search, Plus, Trash2, ArrowUp, ArrowDown, FileText, CornerLeftUp, GripVertical } from 'lucide-react';
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
    if (searchQuery.trim().length === 0) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchAll(searchQuery);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const updateQueue = (newQueue: string[]) => {
    setQueue(newQueue);
    localStorage.setItem('chord-grid-print-queue', JSON.stringify(newQueue));
  };

  const addChart = (id: string) => {
    if (!queue.includes(id)) {
      updateQueue([...queue, id]);
    }
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

  return (
    <div className="w-full max-w-7xl mx-auto px-4 pt-[max(env(safe-area-inset-top,2rem),2rem)] pb-24 min-h-screen">
      <div className="print:hidden">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/')}
              className="p-3 text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all"
              title="Back"
            >
              <CornerLeftUp size={20} />
            </button>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">
              Printer (Setlist)
            </h1>
          </div>
          <div className="flex items-center space-x-4 w-full sm:w-auto mt-4 sm:mt-0">
            <input 
              type="text" 
              value={setlistName}
              onChange={(e) => setSetlistName(e.target.value)}
              placeholder="Setlist Name"
              className="px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-accent-solid transition-colors w-full sm:w-48"
            />
            <button 
              onClick={() => {
                const originalTitle = document.title;
                document.title = setlistName || 'Setlist';
                window.print();
                setTimeout(() => {
                  document.title = originalTitle;
                }, 1000);
              }}
              disabled={queue.length === 0}
              className="px-6 py-2.5 bg-accent-gradient rounded-xl text-white shadow-md hover:brightness-110 transition-all flex items-center justify-center font-bold text-sm disabled:opacity-50 whitespace-nowrap"
            >
              <Printer size={18} className="mr-2" />
              Print
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Queue Management */}
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center">
              <FileText size={18} className="mr-2 text-accent-start" /> Your Print Queue ({queue.length})
            </h2>
            
            {queue.length === 0 ? (
              <div className="p-8 bg-surface border border-border rounded-xl text-center">
                <p className="text-text-secondary text-sm">Your queue is empty. Search for charts to add them.</p>
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

          {/* Right: Search and Add */}
          <div>
            <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center">
              <Search size={18} className="mr-2 text-text-secondary" /> Add to Queue
            </h2>
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-text-secondary" />
              </div>
              <input
                type="text"
                className="block w-full pl-12 pr-4 py-3 bg-surface border border-border rounded-xl leading-5 text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-solid transition-all font-medium shadow-inner"
                placeholder="Search all charts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="space-y-3">
              {isSearching && searchResults.length === 0 && (
                <div className="p-4 text-center text-text-secondary text-sm">No charts found.</div>
              )}
              {searchResults.map((chart) => {
                const inQueue = queue.includes(chart.id);
                return (
                  <div 
                    key={chart.id} 
                    onClick={() => !inQueue && addChart(chart.id)}
                    className={`flex items-center justify-between p-3 bg-surface border rounded-xl transition-all group ${!inQueue ? 'cursor-pointer hover:border-accent-solid hover:shadow-sm border-border' : 'opacity-70 border-border'}`}
                  >
                    <div className="truncate pr-4">
                      <p className="text-sm font-bold text-text-primary truncate group-hover:text-accent-start transition-colors">{chart.title}</p>
                      <p className="text-[10px] text-text-secondary truncate">{chart.path}</p>
                    </div>
                    <button
                      disabled={inQueue}
                      className={`shrink-0 p-2 rounded-lg flex items-center text-xs font-bold transition-colors ${inQueue ? 'text-text-secondary bg-surface-raised cursor-not-allowed' : 'text-accent-start hover:bg-accent-start/10'}`}
                    >
                      {inQueue ? 'Added' : <><Plus size={14} className="mr-1" /> Add</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Print Container */}
      <div className="hidden print:block w-full">
        {queue.map((id, index) => {
          const chart = charts[id];
          if (!chart) return null;
          return (
            <div key={id} style={{ breakAfter: 'page', pageBreakAfter: 'always', marginBottom: '2rem' }} className="w-full">
              <ChartRenderer chart={chart as any} selectedFont={font} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
