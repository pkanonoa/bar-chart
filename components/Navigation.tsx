'use client';

import React, { useState } from 'react';
import { Home, Folder as FolderIcon, Plus, User, Type, FileText, Upload, LogOut, Settings, Trash2, Printer } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { createFolder, saveChart, importChart, saveLyrics } from '@/lib/storage';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [hiddenBySelection, setHiddenBySelection] = useState(false);
  const [hiddenByChartUI, setHiddenByChartUI] = useState(false);
  const [folderKind, setFolderKind] = useState<'chart' | 'lyrics'>('chart');

  React.useEffect(() => {
    const handleSelection = (e: any) => {
      setHiddenBySelection(e.detail > 0);
    };
    const handleUIVisibility = (e: any) => {
      setHiddenByChartUI(!e.detail);
    };
    window.addEventListener('selection-change', handleSelection);
    window.addEventListener('ui-visibility-change', handleUIVisibility);
    return () => {
      window.removeEventListener('selection-change', handleSelection);
      window.removeEventListener('ui-visibility-change', handleUIVisibility);
    };
  }, []);

  // Extract folder ID if we are in a folder
  let currentFolderId: string | null = null;
  if (pathname.startsWith('/folder/')) {
    currentFolderId = pathname.split('/')[2];
  } else if (pathname.startsWith('/lyrics/folder/')) {
    currentFolderId = pathname.split('/')[3];
  }

  const handleCreateFolder = () => {
    setShowAddMenu(false);
    if (pathname.startsWith('/lyrics')) {
      setFolderKind('lyrics');
    } else {
      setFolderKind('chart');
    }
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
      folder_id: pathname.startsWith('/lyrics') ? null : currentFolderId,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };
    await saveChart(chart);
    router.push(`/chart/${chart.id}/edit`);
  };

  const handleCreateLyrics = async () => {
    setShowAddMenu(false);
    if (!user) return;
    const lyrics = {
      id: crypto.randomUUID(),
      title: 'Untitled lyrics',
      body: '',
      folder_id: pathname.startsWith('/lyrics') ? currentFolderId : null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };
    await saveLyrics(lyrics);
    router.push(`/lyrics/${lyrics.id}/edit`);
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
    setShowProfileMenu(false);
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const navItems = [
    {
      id: 'home',
      label: 'Chords',
      icon: <Home className="w-6 h-6 sm:w-7 sm:h-7" />,
      isActive: (pathname === '/' || pathname.startsWith('/folder/')) && !showProfileMenu && !showAddMenu,
      onClick: () => router.push('/'),
    },
    {
      id: 'lyrics',
      label: 'Lyrics',
      icon: <Type className="w-6 h-6 sm:w-7 sm:h-7" />,
      isActive: pathname.startsWith('/lyrics') && !pathname.includes('/printer') && !showProfileMenu && !showAddMenu,
      onClick: () => router.push('/lyrics'),
    },
    {
      id: 'add',
      label: 'Create',
      icon: <Plus className="w-6 h-6 sm:w-7 sm:h-7" />,
      isActive: showAddMenu,
      onClick: () => setShowAddMenu(!showAddMenu),
    },
    {
      id: 'printer',
      label: 'Printer',
      icon: <Printer className="w-6 h-6 sm:w-7 sm:h-7" />,
      isActive: pathname.startsWith('/printer') && !showProfileMenu && !showAddMenu,
      onClick: () => router.push('/printer'),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="w-6 h-6 sm:w-7 sm:h-7" />,
      isActive: showProfileMenu,
      onClick: () => setShowProfileMenu(!showProfileMenu),
    }
  ];

  return null;
}
