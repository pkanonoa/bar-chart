'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { getRecentCharts, createFolder, saveChart } from '@/lib/storage';
import { saveLyrics } from '@/lib/lyrics';
import { X, User, LogOut, Home, Clock, Type, Settings, Plus, Folder as FolderIcon, FileText, Printer, Trash2, Music, Music2, ListMusic, Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [recentCharts, setRecentCharts] = useState<any[]>([]);
  const [selectedFont, setSelectedFont] = useState('system');
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [folderKind, setFolderKind] = useState<'chart' | 'lyrics'>('chart');
  const [joinCode, setJoinCode] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleNav = (path: string) => {
    onClose();
    startTransition(() => {
      router.push(path);
    });
  };

  let currentFolderId: string | null = null;
  if (pathname.startsWith('/folder/')) {
    currentFolderId = pathname.split('/')[2];
  }

  useEffect(() => {
    if (isOpen) {
      getRecentCharts(5).then(setRecentCharts);
      const savedFont = localStorage.getItem('chord-grid-font');
      if (savedFont) setSelectedFont(savedFont);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  const handleFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedFont(val);
    localStorage.setItem('chord-grid-font', val);
    window.dispatchEvent(new Event('chord-grid-font-change'));
  };

  const handleCreateFolder = (kind: 'chart' | 'lyrics') => {
    setFolderKind(kind);
    setCreateFolderModal(true);
  };

  const handleCreateChart = async () => {
    if (!user) return;
    const chart = {
      id: crypto.randomUUID(),
      title: 'Untitled Chart',
      tempo: 120,
      time_sig: '4/4',
      lines: [],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: currentFolderId,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };
    await saveChart(chart);
    router.push(`/chart/${chart.id}/edit`);
    onClose();
  };

  const handleCreateLyrics = async () => {
    if (!user) return;
    const lyrics = {
      id: crypto.randomUUID(),
      title: 'Untitled Lyrics',
      body: '',
      folder_id: pathname.startsWith('/lyrics') ? currentFolderId : null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };
    await saveLyrics(lyrics);
    router.push(`/lyrics/${lyrics.id}/edit`);
    onClose();
  };



  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />
      
      {/* Sidebar Panel */}
      <div className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-surface border-r border-border shadow-popover z-50 transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Profile Header */}
        <div className="p-6 border-b border-border bg-bg">
          <div className="flex justify-between items-start mb-6">
            <div className="h-12 w-12 rounded-full bg-surface border border-accent-solid shadow-inner flex items-center justify-center text-accent-start">
              <User size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary truncate w-40">{user?.email}</p>
              <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold mt-1">Free Plan</p>
            </div>
            <button onClick={onClose} className="p-2 text-text-secondary bg-surface-raised border border-border shadow-inner rounded-full hover:text-white transition-all">
              <X size={16} />
            </button>
          </div>
          <div className="flex space-x-2 mt-2">
            <button onClick={() => handleNav('/profile')} className="flex-1 py-2 bg-surface border border-border shadow-sm rounded-lg text-xs font-bold text-text-secondary hover:text-white transition-all flex justify-center items-center">
              <User size={14} className="mr-1" /> Profile
            </button>
            <button onClick={() => handleNav('/settings')} className="flex-1 py-2 bg-surface border border-border shadow-sm rounded-lg text-xs font-bold text-text-secondary hover:text-white transition-all flex justify-center items-center">
              <Settings size={14} className="mr-1" /> Settings
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto">
          {/* Main Navigation */}
          <div className="p-6 border-b border-border">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-4 flex items-center">
              <Home size={12} className="mr-2" /> Library
            </h3>
            <button 
              onClick={() => handleNav('/')}
              className="w-full flex items-center px-4 py-3 bg-surface border border-border shadow-md rounded-xl text-sm font-bold text-text-primary hover:text-accent-start hover:bg-surface-raised transition-all group mb-3"
            >
              <FolderIcon size={18} className="mr-3 text-text-secondary group-hover:text-accent-start" /> Chords
            </button>
            <button 
              onClick={() => handleNav('/lyrics')}
              className="w-full flex items-center px-4 py-3 bg-surface border border-border shadow-md rounded-xl text-sm font-bold text-text-primary hover:text-accent-start hover:bg-surface-raised transition-all group mb-3"
            >
              <Music size={18} className="mr-3 text-text-secondary group-hover:text-accent-start" /> Lyrics
            </button>
            <button 
              onClick={() => handleNav('/bookmarks')}
              className="w-full flex items-center px-4 py-3 bg-surface border border-border shadow-md rounded-xl text-sm font-bold text-text-primary hover:text-accent-start hover:bg-surface-raised transition-all group mb-3"
            >
              <Star size={18} className="mr-3 text-text-secondary group-hover:text-accent-start" /> Bookmarks
            </button>
            <button 
              onClick={() => handleNav('/setlists')}
              className="w-full flex items-center px-4 py-3 bg-surface border border-border shadow-md rounded-xl text-sm font-bold text-text-primary hover:text-accent-start hover:bg-surface-raised transition-all group mb-3"
            >
              <ListMusic size={18} className="mr-3 text-text-secondary group-hover:text-accent-start" /> Setlists
            </button>
            <button 
              onClick={() => handleNav('/perform')}
              className="w-full flex items-center px-4 py-3 bg-surface border border-border shadow-md rounded-xl text-sm font-bold text-text-primary hover:text-accent-start hover:bg-surface-raised transition-all group mb-3"
            >
              <Music2 size={18} className="mr-3 text-text-secondary group-hover:text-accent-start" /> Perform
            </button>
            <button 
              onClick={() => handleNav('/printer')}
              className="w-full flex items-center px-4 py-3 bg-surface border border-border shadow-md rounded-xl text-sm font-bold text-text-primary hover:text-accent-start hover:bg-surface-raised transition-all group mb-4"
            >
              <Printer size={18} className="mr-3 text-text-secondary group-hover:text-accent-start" /> Printer
            </button>

            {/* Join Session Section inside Sidebar */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-2 flex items-center gap-1">
                <Music2 size={12} className="text-accent-start" /> Join Live Session
              </h4>
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && joinCode.trim().length === 6) {
                      router.push(`/perform/${joinCode.trim().toUpperCase()}`);
                      setJoinCode('');
                      onClose();
                    }
                  }}
                  placeholder="CODE"
                  className="w-20 px-2 py-1.5 bg-surface-raised border border-border rounded-lg text-text-primary placeholder-text-secondary text-center outline-none focus:border-accent-solid font-mono font-bold text-xs tracking-wider transition-all"
                />
                <button
                  onClick={() => {
                    if (joinCode.trim().length === 6) {
                      router.push(`/perform/${joinCode.trim().toUpperCase()}`);
                      setJoinCode('');
                      onClose();
                    }
                  }}
                  disabled={joinCode.trim().length !== 6}
                  className="flex-1 py-1.5 bg-accent-gradient text-white text-xs font-bold rounded-lg disabled:opacity-40 hover:brightness-110 transition-all text-center"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-6 border-b border-border">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-4 flex items-center">
              <Settings size={12} className="mr-2" /> Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button onClick={() => handleCreateFolder('chart')} className="flex flex-col items-center justify-center p-3 bg-surface border border-border shadow-sm hover:bg-surface-raised rounded-xl text-text-secondary hover:text-white transition-all text-xs font-bold">
                <FolderIcon size={18} className="mb-2" /> New Chart Folder
              </button>
              <button onClick={() => handleCreateFolder('lyrics')} className="flex flex-col items-center justify-center p-3 bg-surface border border-border shadow-sm hover:bg-surface-raised rounded-xl text-text-secondary hover:text-white transition-all text-xs font-bold">
                <FolderIcon size={18} className="mb-2" /> New Lyrics Folder
              </button>
              <button onClick={handleCreateChart} className="flex flex-col items-center justify-center p-3 bg-accent-gradient shadow-md rounded-xl text-white hover:brightness-110 transition-all text-xs font-bold">
                <FileText size={18} className="mb-2" /> New Chart
              </button>
              <button onClick={handleCreateLyrics} className="flex flex-col items-center justify-center p-3 bg-accent-gradient shadow-md rounded-xl text-white hover:brightness-110 transition-all text-xs font-bold">
                <Type size={18} className="mb-2" /> New Lyrics
              </button>
            </div>
            

          </div>

          {/* Recent Charts */}
          <div className="p-6 border-b border-border">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-4 flex items-center">
              <Clock size={12} className="mr-2" /> Recent
            </h3>
            {recentCharts.length === 0 ? (
              <p className="text-xs text-text-secondary italic px-2">No recent charts</p>
            ) : (
              <div className="space-y-1">
                {recentCharts.map(chart => (
                  <button
                    key={chart.id}
                    onClick={() => { router.push(`/chart/${chart.id}`); onClose(); }}
                    className="w-full flex items-center px-4 py-2.5 rounded-lg text-sm font-semibold text-text-primary hover:bg-white/5 hover:text-white transition-all text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-start mr-3 shrink-0"></span>
                    <span className="truncate">{chart.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preferences */}
          <div className="p-6 pb-12">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-4 flex items-center">
              <Settings size={12} className="mr-2" /> Preferences
            </h3>
            <div className="bg-surface border border-border shadow-card rounded-xl p-4">
              <label className="flex items-center text-xs font-bold text-text-primary mb-3">
                <Type size={16} className="mr-2 text-text-secondary" /> Chart Font
              </label>
              <select 
                value={selectedFont} 
                onChange={handleFontChange}
                className="w-full bg-surface-raised border border-border shadow-inner text-xs font-bold tracking-wider text-text-primary rounded-lg p-2 focus:outline-none focus:border-accent-solid transition-all"
              >
                <option value="system">System Default</option>
                <option value="monospace">Standard Mono</option>
                <option value="'Courier New', Courier, monospace">Courier New</option>
                <option value="'Lucida Console', Monaco, monospace">Lucida Console</option>
                <option value="'Cascadia Code', 'Cascadia Mono', monospace">Cascadia Code</option>
                <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace">Apple / SF Mono</option>
              </select>
            </div>
            
            <button 
              onClick={() => { router.push('/trash'); onClose(); }}
              className="w-full flex items-center px-4 py-3 mt-4 bg-surface border border-border shadow-sm rounded-xl text-sm font-bold text-text-primary hover:text-red-400 hover:border-red-500/30 transition-all"
            >
              <Trash2 size={16} className="mr-3 text-text-secondary" /> Trash
            </button>
          </div>
        </div>

        {/* Logout Footer */}
        <div className="p-6 border-t border-border bg-bg">
          <button 
            onClick={handleLogout}
            className="flex w-full items-center justify-center px-4 py-3 text-sm font-bold tracking-widest uppercase text-red-500 hover:text-red-400 bg-surface border border-border shadow-md rounded-xl hover:bg-surface-raised transition-all"
          >
            <LogOut size={16} className="mr-2" /> Sign Out
          </button>
        </div>
      </div>

      {/* Create Folder Modal */}
      {createFolderModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-popover border border-border">
            <h3 className="text-xl font-bold text-text-primary mb-6 text-center">New Folder</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('folderName') as HTMLInputElement;
              const name = input.value;
              if (name.trim()) {
                await createFolder(currentFolderId, name.trim(), folderKind);
                if (pathname === '/' || pathname === '/lyrics' || pathname.startsWith('/folder/') || pathname.startsWith('/lyrics/folder/')) {
                  window.dispatchEvent(new Event('refresh-folder'));
                } else {
                  router.push(currentFolderId ? (folderKind === 'lyrics' ? `/lyrics/folder/${currentFolderId}` : `/folder/${currentFolderId}`) : (folderKind === 'lyrics' ? '/lyrics' : '/'));
                }
              }
              setCreateFolderModal(false);
              onClose();
            }}>
              <input
                name="folderName"
                autoFocus
                placeholder="Folder name"
                className="w-full px-4 py-3 bg-surface-raised border border-border shadow-inner rounded-xl text-text-primary focus:outline-none focus:border-accent-solid transition-colors mb-8 font-medium"
              />
              <div className="flex justify-center space-x-4">
                <button type="button" onClick={() => setCreateFolderModal(false)} className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all">Cancel</button>
                <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
