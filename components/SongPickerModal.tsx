'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { searchAll } from '@/lib/storage';
import { X, Search, FileText, Music, Check, Plus } from 'lucide-react';

export type PickedItem = {
  item_type: 'chart' | 'lyrics';
  item_id: string;
  title: string;
};

interface SongPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (items: PickedItem[]) => void;
  /** IDs already in the setlist — used for visual "already added" indicator */
  existingIds?: string[];
}

export function SongPickerModal({ isOpen, onClose, onAdd, existingIds = [] }: SongPickerModalProps) {
  const [tab, setTab] = useState<'chart' | 'lyrics'>('chart');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Map<string, PickedItem>>(new Map());

  const search = useCallback(async (q: string, kind: 'chart' | 'lyrics') => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const res = await searchAll(q, null, kind);
    setResults(res);
    setSearching(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query, tab), 280);
    return () => clearTimeout(t);
  }, [query, tab, search]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelected(new Map());
    }
  }, [isOpen]);

  const toggle = (item: any) => {
    const key = item.id;
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { item_type: tab, item_id: item.id, title: item.title });
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (results.length === 0) return;
    setSelected(prev => {
      const next = new Map(prev);
      results.forEach(item => {
        next.set(item.id, { item_type: tab, item_id: item.id, title: item.title });
      });
      return next;
    });
  };

  const handleAdd = () => {
    if (selected.size === 0) return;
    onAdd(Array.from(selected.values()));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-surface border border-border rounded-t-3xl sm:rounded-3xl shadow-popover flex flex-col max-h-[80vh] sm:max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-text-primary">Add Songs</h2>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-white bg-surface-raised rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-2 shrink-0">
          {(['chart', 'lyrics'] as const).map(k => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
                tab === k
                  ? 'bg-accent-gradient text-white'
                  : 'text-text-secondary hover:text-white bg-surface-raised border border-border'
              }`}
            >
              {k === 'chart' ? <FileText size={13} /> : <Music size={13} />}
              {k === 'chart' ? 'Charts' : 'Lyrics'}
            </button>
          ))}
        </div>

        {/* Search and Select All */}
        <div className="px-4 pb-3 shrink-0 flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-surface-raised border border-border rounded-xl">
            <Search size={15} className="text-text-secondary shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${tab === 'chart' ? 'charts' : 'lyrics'}…`}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-secondary outline-none min-w-0"
            />
            {searching && (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-accent-start border-t-transparent animate-spin shrink-0" />
            )}
          </div>
          {results.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="px-3 py-2 text-xs font-bold text-text-secondary bg-surface-raised border border-border rounded-xl hover:text-white transition-all whitespace-nowrap shrink-0"
            >
              Select All
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
          {!query.trim() && (
            <p className="text-xs text-text-secondary italic text-center py-8">
              Type to search {tab === 'chart' ? 'charts' : 'lyrics'}…
            </p>
          )}
          {query.trim() && !searching && results.length === 0 && (
            <p className="text-xs text-text-secondary italic text-center py-8">No results</p>
          )}
          {results.map(item => {
            const isSelected = selected.has(item.id);
            const alreadyAdded = existingIds.includes(item.item_id || item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggle(item)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'bg-accent-gradient/20 border-accent-solid text-text-primary'
                    : 'bg-surface-raised border-border text-text-secondary hover:text-white hover:border-border/60'
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? 'bg-accent-gradient border-transparent'
                      : 'border-border'
                  }`}
                >
                  {isSelected && <Check size={12} className="text-white" />}
                </div>

                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0">
                  {tab === 'chart'
                    ? <FileText size={15} className="text-accent-start" />
                    : <Music size={15} className="text-accent-end" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{item.title}</p>
                  <p className="text-[10px] text-text-secondary truncate">{item.path || 'Home'}</p>
                </div>

                {alreadyAdded && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary bg-surface px-1.5 py-0.5 rounded-full shrink-0">
                    in set
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border shrink-0">
          <button
            onClick={handleAdd}
            disabled={selected.size === 0}
            className="w-full py-3 bg-accent-gradient text-white font-bold rounded-xl text-sm disabled:opacity-40 hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            {selected.size === 0
              ? 'Select songs to add'
              : `Add ${selected.size} song${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
