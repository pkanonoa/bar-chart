'use client';

import React, { useState } from 'react';
import { Home, Folder as FolderIcon, Plus, User, Type, FileText, Upload, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { createFolder, saveChart, importChart } from '@/lib/storage';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [hiddenBySelection, setHiddenBySelection] = useState(false);
  const [currentFont, setCurrentFont] = useState('system');

  React.useEffect(() => {
    setCurrentFont(localStorage.getItem('chord-grid-font') || 'system');
    
    const handleSelection = (e: any) => {
      setHiddenBySelection(e.detail > 0);
    };
    window.addEventListener('selection-change', handleSelection);
    return () => window.removeEventListener('selection-change', handleSelection);
  }, []);

  // Extract folder ID if we are in a folder
  let currentFolderId: string | null = null;
  if (pathname.startsWith('/folder/')) {
    currentFolderId = pathname.split('/')[2];
  }

  const handleCreateFolder = () => {
    setShowAddMenu(false);
    setCreateFolderModal(true);
  };

  const handleCreateChart = async () => {
    setShowAddMenu(false);
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
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowAddMenu(false);
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
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: <Home size={18} />,
      isActive: pathname === '/' || pathname.startsWith('/folder/'),
      onClick: () => router.push('/'),
    },
    {
      id: 'add',
      label: 'Create',
      icon: <Plus size={18} />,
      isActive: showAddMenu,
      onClick: () => setShowAddMenu(!showAddMenu),
    },
    {
      id: 'fonts',
      label: 'Fonts',
      icon: <Type size={18} />,
      isActive: showFontMenu,
      onClick: () => setShowFontMenu(!showFontMenu),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User size={18} />,
      isActive: showProfileMenu,
      onClick: () => setShowProfileMenu(!showProfileMenu),
    }
  ];

  if (hiddenBySelection) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
      
      {/* Menus popups */}
      {showAddMenu && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-48 bg-surface-raised border border-border rounded-2xl shadow-popover overflow-hidden py-2 animate-in slide-in-from-bottom-2">
          <button onClick={handleCreateFolder} className="w-full px-4 py-3 flex items-center text-sm font-bold text-text-primary hover:bg-white/5 transition-colors">
            <FolderIcon size={16} className="mr-3 text-accent-start" /> New Folder
          </button>
          <button onClick={handleCreateChart} className="w-full px-4 py-3 flex items-center text-sm font-bold text-text-primary hover:bg-white/5 transition-colors">
            <FileText size={16} className="mr-3 text-accent-solid" /> New Chart
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-3 flex items-center text-sm font-bold text-text-primary hover:bg-white/5 transition-colors">
            <Upload size={16} className="mr-3 text-text-secondary" /> Import Chart
          </button>
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImport} />
        </div>
      )}

      {showFontMenu && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 bg-surface-raised border border-border rounded-2xl shadow-popover overflow-hidden p-4 animate-in slide-in-from-bottom-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-3">Chart Font</h3>
          <select
            value={currentFont}
            onChange={(e) => {
              const val = e.target.value;
              setCurrentFont(val);
              localStorage.setItem('chord-grid-font', val);
              window.dispatchEvent(new Event('chord-grid-font-change'));
            }}
            className="w-full bg-surface text-sm font-bold tracking-wider text-text-primary rounded-xl border border-border p-3 focus:outline-none focus:border-accent-solid"
          >
            <option value="system">System Default</option>
            <option value="'Courier New', Courier, monospace">Courier New</option>
            <option value="Consolas, monospace">Consolas</option>
            <option value="'Lucida Console', Monaco, monospace">Lucida Console</option>
            <option value="'Cascadia Code', 'Cascadia Mono', monospace">Cascadia Code</option>
            <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace">Apple / SF Mono</option>
          </select>
        </div>
      )}

      {showProfileMenu && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-56 bg-surface-raised border border-border rounded-2xl shadow-popover overflow-hidden py-2 animate-in slide-in-from-bottom-2">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-bold text-text-primary truncate">{user?.email}</p>
            <p className="text-[10px] uppercase tracking-widest text-text-secondary font-bold mt-1">Free Plan</p>
          </div>
          <button onClick={handleLogout} className="w-full px-4 py-3 flex items-center text-sm font-bold text-red-400 hover:bg-white/5 transition-colors">
            <LogOut size={16} className="mr-3" /> Log Out
          </button>
        </div>
      )}

      {/* Main Pill Nav */}
      <div className="bg-surface-raised border border-border text-text-primary px-2 py-2 rounded-full shadow-popover flex items-center space-x-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              // Close others
              if (item.id !== 'add') setShowAddMenu(false);
              if (item.id !== 'fonts') setShowFontMenu(false);
              if (item.id !== 'profile') setShowProfileMenu(false);
              
              item.onClick();
            }}
            className={`flex items-center transition-all duration-300 ease-in-out ${
              item.isActive 
                ? 'bg-accent-solid px-4 py-2 rounded-full text-white' 
                : 'p-2 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-full'
            }`}
          >
            {item.icon}
            {item.isActive && (
              <span className="ml-2 text-xs font-bold tracking-wider">
                {item.label}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Create Folder Modal */}
      {createFolderModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
    </div>
  );
}
