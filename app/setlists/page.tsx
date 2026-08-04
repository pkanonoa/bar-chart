'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { listSetlists, createSetlist, deleteSetlist, duplicateSetlist, updateSetlist, type Setlist } from '@/lib/setlists';
import {
  ListMusic, Plus, MoreVertical, Trash2, Copy, Pencil, Calendar,
  Music2, CornerLeftUp, X, Check,
} from 'lucide-react';

// ─── New Setlist Modal ────────────────────────────────────────────────────────

function NewSetlistModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (s: Setlist) => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const s = await createSetlist(name.trim(), date || null, notes.trim() || null);
      onCreate(s);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-t-3xl sm:rounded-3xl shadow-popover p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary">New Setlist</h2>
          <button onClick={onClose} className="p-1.5 text-text-secondary hover:text-white rounded-lg transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">
              Name *
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Sunday Service, Gig at The Venue…"
              className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-xl text-text-primary placeholder-text-secondary text-sm outline-none focus:border-accent-solid transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">
              Date (optional)
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm outline-none focus:border-accent-solid transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Venue, key, special instructions…"
              className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-xl text-text-primary placeholder-text-secondary text-sm outline-none focus:border-accent-solid transition-all resize-none"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          className="w-full py-3 bg-accent-gradient text-white font-bold rounded-xl text-sm disabled:opacity-40 hover:brightness-110 transition-all"
        >
          {saving ? 'Creating…' : 'Create Setlist'}
        </button>
      </div>
    </div>
  );
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────

function RenameModal({ setlist, onClose, onRename }: {
  setlist: Setlist;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(setlist.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await updateSetlist(setlist.id, { name: name.trim() });
    onRename(name.trim());
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-surface border border-border rounded-2xl shadow-popover p-5 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-primary">Rename Setlist</h2>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm outline-none focus:border-accent-solid transition-all"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-xs font-bold text-text-secondary bg-surface-raised border border-border rounded-xl hover:text-white transition-all">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex-1 py-2 text-xs font-bold text-white bg-accent-gradient rounded-xl disabled:opacity-40 hover:brightness-110 transition-all"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({ name, onClose, onConfirm }: {
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-surface border border-border rounded-2xl shadow-popover p-5 flex flex-col gap-4">
        <h2 className="text-sm font-bold text-text-primary">Delete Setlist?</h2>
        <p className="text-sm text-text-secondary">
          <span className="text-white font-semibold">"{name}"</span> will be permanently deleted.
          The underlying charts and lyrics will not be affected.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 text-xs font-bold text-text-secondary bg-surface-raised border border-border rounded-xl hover:text-white transition-all">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 text-xs font-bold text-white bg-red-500 rounded-xl hover:bg-red-400 transition-all"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Setlist Card ─────────────────────────────────────────────────────────────

function SetlistCard({
  setlist,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  setlist: Setlist & { songCount?: number };
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const formattedDate = setlist.date
    ? new Date(setlist.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div
      className="bg-surface border border-border rounded-2xl shadow-card hover:shadow-hover transition-all group cursor-pointer relative"
      onClick={onOpen}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-accent-gradient/10 border border-accent-solid/20 flex items-center justify-center shrink-0">
          <ListMusic size={22} className="text-accent-start" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-text-primary text-sm truncate">{setlist.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {formattedDate && (
              <span className="flex items-center gap-1 text-[10px] text-text-secondary">
                <Calendar size={10} /> {formattedDate}
              </span>
            )}
            {setlist.songCount !== undefined && (
              <span className="text-[10px] text-text-secondary">
                {setlist.songCount} song{setlist.songCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-[10px] text-text-secondary/60 mt-0.5">
            Updated {new Date(setlist.updated_at).toLocaleDateString()}
          </p>
        </div>

        {/* Menu */}
        <div className="relative shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="p-2 text-text-secondary hover:text-white bg-surface-raised border border-border rounded-xl opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] bg-surface-raised border border-border rounded-xl shadow-popover overflow-hidden">
                <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onRename(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-white/5 transition-all">
                  <Pencil size={13} /> Rename
                </button>
                <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onDuplicate(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-white/5 transition-all">
                  <Copy size={13} /> Duplicate
                </button>
                <div className="h-px bg-border mx-2" />
                <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SetlistsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [setlists, setSetlists] = useState<(Setlist & { songCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [renaming, setRenaming] = useState<Setlist | null>(null);
  const [deleting, setDeleting] = useState<Setlist | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSetlists();
      // Fetch item counts in one shot
      const { supabase } = await import('@/lib/supabase');
      const counts: Record<string, number> = {};
      if (data.length > 0) {
        const { data: countRows } = await supabase
          .from('setlist_items')
          .select('setlist_id')
          .in('setlist_id', data.map(s => s.id));
        (countRows || []).forEach((r: any) => {
          counts[r.setlist_id] = (counts[r.setlist_id] || 0) + 1;
        });
      }
      setSetlists(data.map(s => ({ ...s, songCount: counts[s.id] || 0 })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);

  const handleCreate = (s: Setlist) => {
    setShowNew(false);
    setSetlists(prev => [{ ...s, songCount: 0 }, ...prev]);
    router.push(`/setlists/${s.id}`);
  };

  const handleRename = (id: string, name: string) => {
    setSetlists(prev => prev.map(s => s.id === id ? { ...s, name } : s));
    setRenaming(null);
  };

  const handleDuplicate = async (id: string) => {
    const dup = await duplicateSetlist(id);
    setSetlists(prev => [{ ...dup, songCount: 0 }, ...prev]);
  };

  const handleDelete = async (id: string) => {
    await deleteSetlist(id);
    setSetlists(prev => prev.filter(s => s.id !== id));
    setDeleting(null);
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto px-4 pt-[max(env(safe-area-inset-top,2rem),2rem)] pb-32">

        {/* Page header */}
        <div className="flex items-center justify-between mb-8 mt-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-3 text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all"
            >
              <CornerLeftUp size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
                <ListMusic size={28} className="text-accent-start" /> Setlists
              </h1>
              <p className="text-xs text-text-secondary font-medium mt-0.5">
                Ordered song collections for gigs and sessions.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-gradient text-white text-sm font-bold rounded-xl shadow-md hover:brightness-110 transition-all"
          >
            <Plus size={16} /> New Setlist
          </button>
        </div>

        {/* List */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-surface border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && setlists.length === 0 && (
          <div className="text-center py-24 text-text-secondary">
            <ListMusic size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-semibold text-base mb-1">No setlists yet</p>
            <p className="text-sm opacity-70">Create one to organize your songs for a gig or session.</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {setlists.map(s => (
            <SetlistCard
              key={s.id}
              setlist={s}
              onOpen={() => router.push(`/setlists/${s.id}`)}
              onRename={() => setRenaming(s)}
              onDuplicate={() => handleDuplicate(s.id)}
              onDelete={() => setDeleting(s)}
            />
          ))}
        </div>
      </main>

      {/* Modals */}
      {showNew && (
        <NewSetlistModal onClose={() => setShowNew(false)} onCreate={handleCreate} />
      )}
      {renaming && (
        <RenameModal
          setlist={renaming}
          onClose={() => setRenaming(null)}
          onRename={name => handleRename(renaming.id, name)}
        />
      )}
      {deleting && (
        <ConfirmDeleteModal
          name={deleting.name}
          onClose={() => setDeleting(null)}
          onConfirm={() => handleDelete(deleting.id)}
        />
      )}
    </div>
  );
}
