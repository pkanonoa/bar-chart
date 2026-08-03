'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { getRecentCharts, createFolder, saveChart, importChart } from '@/lib/storage';
import { X, User, LogOut, Home, Clock, Type, Settings, Plus, Upload, Folder as FolderIcon, FileText, Printer } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [recentCharts, setRecentCharts] = useState<any[]>([]);
  const [selectedFont, setSelectedFont] = useState('system');
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleCreateFolder = () => {
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importChart(file, currentFolderId);
      if (pathname === '/' || pathname.startsWith('/folder/')) {
        window.dispatchEvent(new Event('refresh-folder'));
      } else {
        router.push(currentFolderId ? `/folder/${currentFolderId}` : '/');
      }
    } catch (err) {
      alert('Failed to import chart.');
    }
    e.target.value = '';
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
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto">
          {/* Main Navigation */}
          <div className="p-6 border-b border-border">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-4 flex items-center">
              <Home size={12} className="mr-2" /> Library
            </h3>
            <button 
              onClick={() => { router.push('/'); onClose(); }}
              className="w-full flex items-center px-4 py-3 bg-surface border border-border shadow-md rounded-xl text-sm font-bold text-text-primary hover:text-accent-start hover:bg-surface-raised transition-all group mb-3"
            >
              <FolderIcon size={18} className="mr-3 text-text-secondary group-hover:text-accent-start" /> Chords
            </button>
            <button 
              onClick={() => { router.push('/printer'); onClose(); }}
              className="w-full flex items-center px-4 py-3 bg-surface border border-border shadow-md rounded-xl text-sm font-bold text-text-primary hover:text-accent-start hover:bg-surface-raised transition-all group"
            >
              <Printer size={18} className="mr-3 text-text-secondary group-hover:text-accent-start" /> Printer
            </button>
          </div>

          {/* Quick Actions */}
          <div className="p-6 border-b border-border">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-4 flex items-center">
              <Settings size={12} className="mr-2" /> Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleCreateFolder} className="flex flex-col items-center justify-center p-3 bg-surface border border-border shadow-sm hover:bg-surface-raised rounded-xl text-text-secondary hover:text-white transition-all text-xs font-bold">
                <FolderIcon size={18} className="mb-2" /> New Folder
              </button>
              <button onClick={handleCreateChart} className="flex flex-col items-center justify-center p-3 bg-accent-gradient shadow-md rounded-xl text-white hover:brightness-110 transition-all text-xs font-bold">
                <FileText size={18} className="mb-2" /> New Chart
              </button>
              
              <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="col-span-2 flex items-center justify-center p-3 bg-surface border border-border shadow-sm hover:bg-surface-raised rounded-xl text-text-secondary hover:text-white transition-all text-xs font-bold">
                <Upload size={16} className="mr-2" /> Import Chart JSON
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
                await createFolder(currentFolderId, name.trim());
                if (pathname === '/' || pathname.startsWith('/folder/')) {
                  window.dispatchEvent(new Event('refresh-folder'));
                } else {
                  router.push(currentFolderId ? `/folder/${currentFolderId}` : '/');
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
