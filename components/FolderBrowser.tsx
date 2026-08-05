'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Folder, Chart, listFolder, createFolder, renameEntry,
  deleteEntry, moveToTrash, moveEntry, saveChart, searchAll, exportChart, toggleBookmark
} from '@/lib/storage';
import { FolderPickerModal } from './FolderPickerModal';
import { useAuth } from '@/components/AuthProvider';
import {
  Folder as FolderIcon, FileText, MoreVertical, Search,
  Plus, CornerLeftUp, Trash2, Edit2, CornerRightDown, Download, X,
  FolderPlus, FilePlus, Printer, Star, LayoutGrid, List
} from 'lucide-react';

interface Props {
  folderId: string | null;
  folderName?: string; // Passed if inside a subfolder
  kind?: 'chart' | 'lyrics';
}

export function FolderBrowser({ folderId, folderName, kind = 'chart' }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [charts, setCharts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // View state (Grid vs List)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const saved = localStorage.getItem('chord-grid-view-mode') as 'grid' | 'list';
    if (saved === 'grid' || saved === 'list') {
      setViewMode(saved);
    }
  }, []);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modals state
  const [moveItem, setMoveItem] = useState<{ id: string, type: 'folder' | 'chart' | 'lyrics' } | null>(null);
  const [isBulkMove, setIsBulkMove] = useState(false);
  const [renameItem, setRenameItem] = useState<{ id: string, type: 'folder' | 'chart' | 'lyrics', currentName: string } | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: string, type: 'folder' | 'chart' | 'lyrics', name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
  const [createFolderModal, setCreateFolderModal] = useState(false);

  // Selection state
  const [selectedItems, setSelectedItems] = useState<{ id: string, type: 'folder' | 'chart' | 'lyrics' }[]>([]);

  useEffect(() => {
    const evt = new CustomEvent('selection-change', { detail: selectedItems.length });
    window.dispatchEvent(evt);
    return () => {
      window.dispatchEvent(new CustomEvent('selection-change', { detail: 0 }));
    };
  }, [selectedItems]);

  // Dropdown state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
  const [dropdownHorizontal, setDropdownHorizontal] = useState<'left' | 'right'>('right');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Long press gesture handling
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastLongPressTime = useRef(0);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (id: string, type: 'folder' | 'chart' | 'lyrics', e: React.PointerEvent) => {
    startPos.current = { x: e.clientX, y: e.clientY };
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      lastLongPressTime.current = Date.now();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(50); } catch (e) {}
      }
      setSelectedItems(prev => {
        const exists = prev.some(i => i.id === id);
        if (exists) return prev.filter(i => i.id !== id);
        return [...prev, { id, type }];
      });
    }, 400);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startPos.current && longPressTimer.current) {
      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleCardClick = (id: string, type: 'folder' | 'chart' | 'lyrics', e: React.MouseEvent, onNormalClick: () => void) => {
    if (Date.now() - lastLongPressTime.current < 600) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (selectedItems.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      setSelectedItems(prev => {
        const exists = prev.some(i => i.id === id);
        if (exists) return prev.filter(i => i.id !== id);
        return [...prev, { id, type }];
      });
      return;
    }

    onNormalClick();
  };



  const loadContents = async () => {
    setLoading(true);
    try {
      const res = await listFolder(folderId, kind);
      setFolders(res.folders);
      setCharts(res.charts);
    } catch (err) {
      console.error('Failed to load contents', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadContents();
    
    const handleRefresh = () => loadContents();
    window.addEventListener('refresh-folder', handleRefresh);
    return () => window.removeEventListener('refresh-folder', handleRefresh);
  }, [folderId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchAll(searchQuery, folderId, kind);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, folderId]);


  const executeRename = async (newName: string) => {
    if (renameItem && newName.trim() !== '' && newName.trim() !== renameItem.currentName) {
      await renameEntry(renameItem.id, renameItem.type, newName.trim());
      loadContents();
    }
    setRenameItem(null);
  };

  const handleCreateFolder = () => {
    setCreateFolderModal(true);
  };

  const handleCreateChart = async () => {
    if (!user) return;
    if (kind === 'lyrics') {
      const lyrics = {
        id: crypto.randomUUID(),
        title: 'Untitled lyrics',
        body: '',
        folder_id: folderId,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };
      const { saveLyrics } = await import('@/lib/storage');
      await saveLyrics(lyrics);
      router.push(`/lyrics/${lyrics.id}/edit`);
    } else {
      const chart = {
        id: crypto.randomUUID(),
        title: 'Untitled Chart',
        tempo: 120,
        time_sig: '4/4',
        lines: [],
        semitone_offset: 0,
        prefer_flats: false,
        folder_id: folderId,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };
      await saveChart(chart);
      router.push(`/chart/${chart.id}/edit`);
    }
  };



  const executeDelete = async (permanent: boolean = false) => {
    if (deleteItem) {
      if (permanent) {
        await deleteEntry(deleteItem.id, deleteItem.type);
      } else {
        await moveToTrash(deleteItem.id, deleteItem.type);
      }
      loadContents();
    }
    setDeleteItem(null);
    setDeleteConfirmText('');
  };

  const executeMove = async (targetFolderId: string | null) => {
    if (isBulkMove) {
      await Promise.all(selectedItems.map(item => moveEntry(item.id, item.type, targetFolderId)));
      setSelectedItems([]);
      setIsBulkMove(false);
      loadContents();
    } else if (moveItem) {
      await moveEntry(moveItem.id, moveItem.type, targetFolderId);
      loadContents();
    }
    setMoveItem(null);
  };

  const handleToggleBookmark = async (chart: any) => {
    const newValue = !chart.is_bookmarked;
    await toggleBookmark(chart.id, chart.type as 'chart' | 'lyrics', newValue);
    // Optimistic update
    setCharts(prev => prev.map(c => c.id === chart.id ? { ...c, is_bookmarked: newValue } : c));
    if (searchResults) {
      setSearchResults(prev => prev.map(c => c.id === chart.id ? { ...c, is_bookmarked: newValue } : c));
    }
  };

  const handleBulkDelete = async (permanent: boolean = false) => {
    if (permanent) {
      await Promise.all(selectedItems.map(item => deleteEntry(item.id, item.type)));
    } else {
      await Promise.all(selectedItems.map(item => moveToTrash(item.id, item.type)));
    }
    setSelectedItems([]);
    setBulkDeleteModal(false);
    setDeleteConfirmText('');
    loadContents();
  };

  const toggleSelection = (id: string, type: 'folder' | 'chart' | 'lyrics', e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItems(prev => {
      const exists = prev.find(item => item.id === id);
      if (exists) return prev.filter(item => item.id !== id);
      return [...prev, { id, type }];
    });
  };

  const handleSelectAll = () => {
    if (isSearching) {
      setSelectedItems(searchResults.map(c => ({ id: c.id, type: c.type || kind })));
    } else {
      const allFolders = folders.map(f => ({ id: f.id, type: 'folder' as const }));
      const allCharts = charts.map(c => ({ id: c.id, type: c.type || kind as any }));
      setSelectedItems([...allFolders, ...allCharts]);
    }
  };

  const RowMenu = ({ id, type, name }: { id: string, type: 'folder' | 'chart' | 'lyrics', name: string }) => {
    const isOpen = activeDropdown === id;
    return (
      <div className="relative" ref={isOpen ? dropdownRef : null}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isOpen) {
              const rect = e.currentTarget.getBoundingClientRect();
              if (window.innerHeight - rect.bottom < 200) {
                setDropdownDirection('up');
              } else {
                setDropdownDirection('down');
              }
              setActiveDropdown(id);
            } else {
              setActiveDropdown(null);
            }
          }}
          className="p-2 text-text-secondary hover:text-accent-start rounded-md hover:bg-white/5 focus:outline-none transition-colors"
        >
          <MoreVertical size={18} />
        </button>

        {isOpen && (
          <div className={`absolute right-0 ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} w-48 bg-[#161033] rounded-xl shadow-2xl z-[9999] border border-white/20 py-1`}>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setRenameItem({ id, type, currentName: name }); }}
              className="flex items-center w-full px-4 py-2 text-xs uppercase tracking-widest font-bold text-text-secondary hover:bg-white/5 hover:text-white"
            >
              <Edit2 size={14} className="mr-2" /> Rename
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setMoveItem({ id, type }); }}
              className="flex items-center w-full px-4 py-2 text-xs uppercase tracking-widest font-bold text-text-secondary hover:bg-white/5 hover:text-white"
            >
              <CornerRightDown size={14} className="mr-2" /> Move
            </button>
            {type === 'chart' && (
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setActiveDropdown(null); 
                  const q = JSON.parse(localStorage.getItem('chord-grid-print-queue') || '[]');
                  if (!q.includes(id)) {
                    localStorage.setItem('chord-grid-print-queue', JSON.stringify([...q, id]));
                    alert('Added to print queue');
                  } else {
                    alert('Already in print queue');
                  }
                }}
                className="flex items-center w-full px-4 py-2 text-xs uppercase tracking-widest font-bold text-text-secondary hover:bg-white/5 hover:text-white"
              >
                <Printer size={14} className="mr-2" /> Add to Printer
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setDeleteItem({ id, type, name }); setDeleteConfirmText(''); }}
              className="flex items-center w-full px-4 py-2 text-xs uppercase tracking-widest font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 size={14} className="mr-2" /> Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 pt-[max(env(safe-area-inset-top,2rem),2rem)] pb-8">
      {/* Back button (only inside subfolders) */}
      {folderId && (
        <div className="mb-4">
          <button
            onClick={() => router.push(kind === 'lyrics' ? '/lyrics' : '/')}
            className="p-2.5 text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all"
            title="Back"
          >
            <CornerLeftUp size={18} />
          </button>
        </div>
      )}

      {/* Search + action icon buttons on one row */}
      <div className="flex items-center gap-2 mb-8">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-text-secondary" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-solid transition-all font-medium"
            placeholder={folderId ? 'Search in folder…' : kind === 'lyrics' ? 'Search lyrics…' : 'Search charts…'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* View Mode Toggle Button */}
        <button
          onClick={() => {
            const nextMode = viewMode === 'grid' ? 'list' : 'grid';
            setViewMode(nextMode);
            localStorage.setItem('chord-grid-view-mode', nextMode);
          }}
          title={viewMode === 'grid' ? 'Switch to List View' : 'Switch to Grid View'}
          className="p-2.5 text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all shrink-0"
        >
          {viewMode === 'grid' ? <List size={18} /> : <LayoutGrid size={18} />}
        </button>

        {/* New Folder icon */}
        <button
          onClick={handleCreateFolder}
          title="New Folder"
          className="p-2.5 text-text-secondary bg-surface border border-border rounded-xl hover:text-accent-start hover:bg-surface-raised transition-all shrink-0"
        >
          <FolderPlus size={18} />
        </button>



        {/* New Chart / New Lyrics — gradient icon + label */}
        <button
          onClick={handleCreateChart}
          title={kind === 'lyrics' ? 'New Lyrics' : 'New Chart'}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-accent-gradient text-white text-xs font-bold rounded-xl shadow-md hover:brightness-110 transition-all shrink-0"
        >
          <FilePlus size={16} />
          <span className="hidden sm:inline">{kind === 'lyrics' ? 'New Lyrics' : 'New Chart'}</span>
        </button>
      </div>


      {/* Content Area */}
      <div className="pt-4 pb-20">
        {loading && !isSearching ? (
          <div className="p-12 text-center text-text-secondary font-medium">Loading...</div>
        ) : isSearching ? (
          <div className={viewMode === 'list' ? 'flex flex-col gap-2.5' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6'}>
            {searchResults.length === 0 ? (
              <div className="col-span-full p-12 text-center text-text-secondary font-medium">No charts found matching "{searchQuery}"</div>
            ) : (
              searchResults.map((chart) => (
                viewMode === 'list' ? (
                  <div
                    key={chart.id}
                    className={`bg-surface border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer group relative transition-all duration-200 select-none ${
                      selectedItems.some(i => i.id === chart.id) ? 'border-accent-solid shadow-md bg-surface-raised' : 'border-border shadow-sm hover:bg-surface-raised hover:-translate-x-0.5'
                    } ${activeDropdown === chart.id ? 'z-[999]' : ''}`}
                    style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                    onPointerDown={(e) => handlePointerDown(chart.id, kind, e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onClick={(e) => handleCardClick(chart.id, kind, e, () => router.push(kind === 'lyrics' ? `/lyrics/${chart.id}` : `/chart/${chart.id}`))}
                    onContextMenu={(e) => { e.preventDefault(); }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      <div onClick={e => e.stopPropagation()} className="shrink-0">
                        <input
                          type="checkbox"
                          checked={selectedItems.some(i => i.id === chart.id)}
                          onChange={() => {}}
                          onClick={(e) => toggleSelection(chart.id, kind, e)}
                          className="w-4 h-4 rounded border-border text-accent-solid focus:ring-accent-solid bg-transparent"
                        />
                      </div>
                      <div className="w-10 h-10 bg-surface-raised rounded-xl flex items-center justify-center shrink-0 border border-border">
                        <FileText size={20} className="text-accent-start" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-text-primary truncate">{chart.title}</p>
                        <p className="text-[10px] text-text-secondary">{new Date(chart.updated_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        className={`p-1.5 rounded-full hover:bg-white/10 transition-all ${
                          activeDropdown === chart.id
                            ? 'opacity-0 pointer-events-none'
                            : chart.is_bookmarked
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBookmark(chart);
                        }}
                        title={chart.is_bookmarked ? 'Remove Bookmark' : 'Bookmark Chart'}
                      >
                        <Star size={16} className={chart.is_bookmarked ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]" : "text-text-secondary/40 hover:text-yellow-400"} />
                      </button>
                      <RowMenu id={chart.id} type={kind} name={chart.title} />
                    </div>
                  </div>
                ) : (
                  <div
                    key={chart.id}
                    className={`bg-surface border rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer group relative transition-all duration-200 select-none ${
                      selectedItems.some(i => i.id === chart.id) ? 'border-accent-solid shadow-md bg-surface-raised before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-accent-gradient before:rounded-l-xl' : 'border-border shadow-sm hover:shadow-hover hover:-translate-y-1'
                    } ${activeDropdown === chart.id ? 'z-[999]' : ''}`}
                    style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                    onPointerDown={(e) => handlePointerDown(chart.id, kind, e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onClick={(e) => handleCardClick(chart.id, kind, e, () => router.push(kind === 'lyrics' ? `/lyrics/${chart.id}` : `/chart/${chart.id}`))}
                    onContextMenu={(e) => { e.preventDefault(); }}
                  >
                    <div className="absolute top-3 left-3 z-10" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedItems.some(i => i.id === chart.id)}
                        onChange={() => {}}
                        onClick={(e) => toggleSelection(chart.id, kind, e)}
                        className="w-4 h-4 rounded border-border text-accent-solid focus:ring-accent-solid bg-transparent"
                      />
                    </div>
                    <div className="absolute top-2 right-2 z-10" onClick={e => e.stopPropagation()}>
                      <RowMenu id={chart.id} type={kind} name={chart.title} />
                    </div>
                    <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mb-4 mt-2 shadow-inner border border-border">
                      <FileText size={24} className="text-accent-start" />
                    </div>
                    <p className="text-sm font-bold text-text-primary text-center w-full truncate">{chart.title}</p>
                    <p className="text-[10px] text-text-secondary mt-1">{new Date(chart.updated_at).toLocaleDateString()}</p>
                    <button
                      className={`absolute bottom-3 right-3 z-10 p-1.5 rounded-full hover:bg-white/10 transition-all ${
                        activeDropdown === chart.id
                          ? 'opacity-0 pointer-events-none'
                          : chart.is_bookmarked
                          ? 'opacity-100 scale-100'
                          : 'opacity-0 group-hover:opacity-100 scale-90 hover:scale-100'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleBookmark(chart);
                      }}
                      title={chart.is_bookmarked ? 'Remove Bookmark' : 'Bookmark Chart'}
                    >
                      <Star size={16} className={chart.is_bookmarked ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]" : "text-text-secondary/40 hover:text-yellow-400"} />
                    </button>
                  </div>
                )
              ))
            )}
          </div>
        ) : (
          <div className={viewMode === 'list' ? 'flex flex-col gap-2.5' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6'}>
            {folders.length === 0 && charts.length === 0 ? (
              <div className="col-span-full p-16 text-center">
                <div className="mx-auto h-20 w-20 bg-surface-raised rounded-full shadow-inner border border-border flex items-center justify-center mb-6">
                  <FolderIcon size={32} className="text-text-secondary opacity-50" strokeWidth={2} />
                </div>
                <h3 className="text-sm font-bold text-text-primary mb-2">This folder is empty</h3>
                <p className="text-xs text-text-secondary">Get started by creating a new folder or chart.</p>
              </div>
            ) : (
              <>
                {folders.map(folder => (
                  viewMode === 'list' ? (
                    <div
                      key={folder.id}
                      className={`bg-surface border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer group relative transition-all duration-200 select-none ${
                        selectedItems.some(i => i.id === folder.id) ? 'border-accent-solid shadow-md bg-surface-raised' : 'border-border shadow-sm hover:bg-surface-raised hover:-translate-x-0.5'
                      } ${activeDropdown === folder.id ? 'z-[999]' : ''}`}
                      style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                      onPointerDown={(e) => handlePointerDown(folder.id, 'folder', e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onClick={(e) => handleCardClick(folder.id, 'folder', e, () => router.push(kind === 'lyrics' ? `/lyrics/folder/${folder.id}` : `/folder/${folder.id}`))}
                      onContextMenu={(e) => { e.preventDefault(); }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <div onClick={e => e.stopPropagation()} className="shrink-0">
                          <input
                            type="checkbox"
                            checked={selectedItems.some(i => i.id === folder.id)}
                            onChange={() => {}}
                            onClick={(e) => toggleSelection(folder.id, 'folder', e)}
                            className="w-4 h-4 rounded border-border text-accent-solid focus:ring-accent-solid bg-transparent"
                          />
                        </div>
                        <div className="w-10 h-10 bg-surface-raised rounded-xl flex items-center justify-center shrink-0 border border-border">
                          <FolderIcon size={20} className="text-text-primary opacity-60" fill="currentColor" fillOpacity={0.15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-text-primary truncate">{folder.name}</p>
                          <p className="text-[10px] text-text-secondary">{new Date(folder.updated_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div onClick={e => e.stopPropagation()} className="shrink-0">
                        <RowMenu id={folder.id} type="folder" name={folder.name} />
                      </div>
                    </div>
                  ) : (
                    <div
                      key={folder.id}
                      className={`bg-surface border rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer group relative transition-all duration-200 select-none ${
                        selectedItems.some(i => i.id === folder.id) ? 'border-accent-solid shadow-md bg-surface-raised before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-accent-gradient before:rounded-l-xl' : 'border-border shadow-sm hover:shadow-hover hover:-translate-y-1'
                      } ${activeDropdown === folder.id ? 'z-[999]' : ''}`}
                      style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                      onPointerDown={(e) => handlePointerDown(folder.id, 'folder', e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onClick={(e) => handleCardClick(folder.id, 'folder', e, () => router.push(kind === 'lyrics' ? `/lyrics/folder/${folder.id}` : `/folder/${folder.id}`))}
                      onContextMenu={(e) => { e.preventDefault(); }}
                    >
                      <div className="absolute top-3 left-3 z-10" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedItems.some(i => i.id === folder.id)}
                          onChange={() => {}}
                          onClick={(e) => toggleSelection(folder.id, 'folder', e)}
                          className="w-4 h-4 rounded border-border text-accent-solid focus:ring-accent-solid bg-transparent"
                        />
                      </div>
                      <div className="absolute top-2 right-2 z-10" onClick={e => e.stopPropagation()}>
                        <RowMenu id={folder.id} type="folder" name={folder.name} />
                      </div>
                      <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mb-4 mt-2 shadow-inner border border-border">
                        <FolderIcon size={24} className="text-text-primary opacity-50" fill="currentColor" fillOpacity={0.1} />
                      </div>
                      <p className="text-sm font-bold text-text-primary text-center w-full truncate">{folder.name}</p>
                      <p className="text-[10px] text-text-secondary mt-1">{new Date(folder.updated_at).toLocaleDateString()}</p>
                    </div>
                  )
                ))}
                
                {charts.map(chart => (
                  viewMode === 'list' ? (
                    <div
                      key={chart.id}
                      className={`bg-surface border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer group relative transition-all duration-200 select-none ${
                        selectedItems.some(i => i.id === chart.id) ? 'border-accent-solid shadow-md bg-surface-raised' : 'border-border shadow-sm hover:bg-surface-raised hover:-translate-x-0.5'
                      } ${activeDropdown === chart.id ? 'z-[999]' : ''}`}
                      style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                      onPointerDown={(e) => handlePointerDown(chart.id, kind, e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onClick={(e) => handleCardClick(chart.id, kind, e, () => router.push(kind === 'lyrics' ? `/lyrics/${chart.id}` : `/chart/${chart.id}`))}
                      onContextMenu={(e) => { e.preventDefault(); }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <div onClick={e => e.stopPropagation()} className="shrink-0">
                          <input
                            type="checkbox"
                            checked={selectedItems.some(i => i.id === chart.id)}
                            onChange={() => {}}
                            onClick={(e) => toggleSelection(chart.id, kind, e)}
                            className="w-4 h-4 rounded border-border text-accent-solid focus:ring-accent-solid bg-transparent"
                          />
                        </div>
                        <div className="w-10 h-10 bg-surface-raised rounded-xl flex items-center justify-center shrink-0 border border-border">
                          <FileText size={20} className="text-accent-start" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-text-primary truncate">{chart.title}</p>
                          <p className="text-[10px] text-text-secondary">{new Date(chart.updated_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          className={`p-1.5 rounded-full hover:bg-white/10 transition-all ${
                            activeDropdown === chart.id
                              ? 'opacity-0 pointer-events-none'
                              : chart.is_bookmarked
                              ? 'opacity-100 scale-100'
                              : 'opacity-0 group-hover:opacity-100 scale-90 hover:scale-100'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBookmark(chart);
                          }}
                          title={chart.is_bookmarked ? 'Remove Bookmark' : 'Bookmark Chart'}
                        >
                          <Star size={16} className={chart.is_bookmarked ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]" : "text-text-secondary/40 hover:text-yellow-400"} />
                        </button>
                        <RowMenu id={chart.id} type={kind} name={chart.title} />
                      </div>
                    </div>
                  ) : (
                    <div
                      key={chart.id}
                      className={`bg-surface border rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer group relative transition-all duration-200 select-none ${
                        selectedItems.some(i => i.id === chart.id) ? 'border-accent-solid shadow-md bg-surface-raised before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-accent-gradient before:rounded-l-xl' : 'border-border shadow-sm hover:shadow-hover hover:-translate-y-1'
                      } ${activeDropdown === chart.id ? 'z-[999]' : ''}`}
                      style={{ touchAction: 'manipulation', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
                      onPointerDown={(e) => handlePointerDown(chart.id, kind, e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onClick={(e) => handleCardClick(chart.id, kind, e, () => router.push(kind === 'lyrics' ? `/lyrics/${chart.id}` : `/chart/${chart.id}`))}
                      onContextMenu={(e) => { e.preventDefault(); }}
                    >
                      <div className="absolute top-3 left-3 z-10" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedItems.some(i => i.id === chart.id)}
                          onChange={() => {}}
                          onClick={(e) => toggleSelection(chart.id, kind, e)}
                          className="w-4 h-4 rounded border-border text-accent-solid focus:ring-accent-solid bg-transparent"
                        />
                      </div>
                      <div className="absolute top-2 right-2 z-10" onClick={e => e.stopPropagation()}>
                        <RowMenu id={chart.id} type={kind} name={chart.title} />
                      </div>
                      <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mb-4 mt-2 shadow-inner border border-border">
                        <FileText size={24} className="text-accent-start" />
                      </div>
                      <p className="text-sm font-bold text-text-primary text-center w-full truncate">{chart.title}</p>
                      <p className="text-[10px] text-text-secondary mt-1">{new Date(chart.updated_at).toLocaleDateString()}</p>
                      <button
                        className={`absolute bottom-3 right-3 z-10 p-1.5 rounded-full hover:bg-white/10 transition-all ${
                          activeDropdown === chart.id
                            ? 'opacity-0 pointer-events-none'
                            : chart.is_bookmarked
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 group-hover:opacity-100 scale-90 hover:scale-100'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBookmark(chart);
                        }}
                        title={chart.is_bookmarked ? 'Remove Bookmark' : 'Bookmark Chart'}
                      >
                        <Star size={16} className={chart.is_bookmarked ? "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]" : "text-text-secondary/40 hover:text-yellow-400"} />
                      </button>
                    </div>
                  )
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bulk Action Bar (Pill) */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-surface-raised border border-border text-text-primary px-4 py-2 rounded-full shadow-popover flex items-center space-x-3 animate-in slide-in-from-bottom-4">
          <span className="text-xs font-bold text-text-primary whitespace-nowrap">
            {selectedItems.length} selected
          </span>
          <div className="flex space-x-2 border-l border-border pl-3">
            <button
              onClick={handleSelectAll}
              className="px-4 py-1.5 text-xs font-bold text-text-primary bg-surface border border-border rounded-full hover:text-accent-start hover:bg-white/5 transition-all"
            >
              Select All
            </button>
            <button
              onClick={() => setIsBulkMove(true)}
              className="px-4 py-1.5 text-xs font-bold text-text-primary bg-surface border border-border rounded-full hover:text-accent-start hover:bg-white/5 transition-all"
            >
              Move
            </button>
            <button
              onClick={() => { setBulkDeleteModal(true); setDeleteConfirmText(''); }}
              className="px-4 py-1.5 text-xs font-bold text-white bg-red-600/90 rounded-full hover:bg-red-600 shadow-md transition-all"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedItems([])}
              className="ml-1 p-1.5 text-text-secondary hover:text-white transition-all rounded-full hover:bg-white/5"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <FolderPickerModal
        isOpen={!!moveItem || isBulkMove}
        onClose={() => { setMoveItem(null); setIsBulkMove(false); }}
        onMoveHere={executeMove}
        excludeIds={isBulkMove ? selectedItems.filter(i => i.type === 'folder').map(i => i.id) : (moveItem?.type === 'folder' ? [moveItem.id] : [])}
      />

      {/* Inline Rename Modal */}
      {renameItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-popover border border-border">
            <h3 className="text-xl font-bold text-text-primary mb-6 text-center">Rename {renameItem.type}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('newName') as HTMLInputElement;
              executeRename(input.value);
            }}>
              <input
                name="newName"
                autoFocus
                defaultValue={renameItem.currentName}
                className="w-full px-4 py-3 bg-surface-raised border border-border shadow-inner rounded-xl text-text-primary focus:outline-none focus:border-accent-solid transition-colors mb-8 font-medium"
              />
              <div className="flex justify-center space-x-4">
                <button type="button" onClick={() => setRenameItem(null)} className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all">Cancel</button>
                <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Delete Confirmation */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-popover border border-border text-center">
            <div className="w-16 h-16 mx-auto bg-surface-raised shadow-inner border border-border rounded-full flex items-center justify-center mb-6">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-3">Delete {deleteItem.type}?</h3>
            <p className="text-sm text-text-secondary mb-4 font-medium px-4">
              Are you sure you want to delete "{deleteItem.name}"?
              {deleteItem.type === 'folder' && " All nested folders and charts will also be permanently deleted."}
            </p>
            <div className="flex justify-center space-x-4">
              <button onClick={() => { setDeleteItem(null); setDeleteConfirmText(''); }} className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all">Cancel</button>
              <button 
                onClick={() => executeDelete(false)} 
                className="px-4 py-2.5 text-sm font-bold text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all"
              >
                Move to Trash
              </button>
              <button 
                onClick={() => executeDelete(true)} 
                className="px-4 py-2.5 text-sm font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl shadow-md hover:bg-red-500 hover:text-white transition-all"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      {bulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-8 w-full max-w-lg shadow-popover border border-border text-center">
            <div className="w-16 h-16 mx-auto bg-surface-raised shadow-inner border border-border rounded-full flex items-center justify-center mb-6">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-3">Delete {selectedItems.length} items?</h3>
            <p className="text-sm text-text-secondary mb-4 font-medium px-4">
              Are you sure you want to delete {selectedItems.length} items? All nested folders and charts will also be affected.
            </p>
            <div className="flex justify-center space-x-3">
              <button onClick={() => { setBulkDeleteModal(false); setDeleteConfirmText(''); }} className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all">Cancel</button>
              <button 
                onClick={() => handleBulkDelete(false)} 
                className="px-4 py-2.5 text-sm font-bold text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all"
              >
                Move to Trash
              </button>
              <button 
                onClick={() => handleBulkDelete(true)} 
                className="px-4 py-2.5 text-sm font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl shadow-md hover:bg-red-500 hover:text-white transition-all"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {createFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-popover border border-border">
            <h3 className="text-xl font-bold text-text-primary mb-6 text-center">New Folder</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('folderName') as HTMLInputElement;
              const name = input.value;
              if (name.trim()) {
                await createFolder(folderId, name.trim(), kind);
                loadContents();
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
