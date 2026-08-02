'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Folder, Chart, listFolder, createFolder, renameEntry,
  deleteEntry, moveToTrash, moveEntry, saveChart, searchAll, exportChart, importChart
} from '@/lib/storage';
import { FolderPickerModal } from './FolderPickerModal';
import { useAuth } from '@/components/AuthProvider';
import {
  Folder as FolderIcon, FileText, MoreVertical, Search,
  Plus, Upload, CornerLeftUp, Trash2, Edit2, CornerRightDown, Download, X,
  FolderPlus, FilePlus
} from 'lucide-react';

interface Props {
  folderId: string | null;
  folderName?: string; // Passed if inside a subfolder
}

export function FolderBrowser({ folderId, folderName }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [charts, setCharts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modals state
  const [moveItem, setMoveItem] = useState<{ id: string, type: 'folder' | 'chart' } | null>(null);
  const [isBulkMove, setIsBulkMove] = useState(false);
  const [renameItem, setRenameItem] = useState<{ id: string, type: 'folder' | 'chart', currentName: string } | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: string, type: 'folder' | 'chart', name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);
  const [createFolderModal, setCreateFolderModal] = useState(false);

  // Selection state
  const [selectedItems, setSelectedItems] = useState<{ id: string, type: 'folder' | 'chart' }[]>([]);

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadContents = async () => {
    setLoading(true);
    try {
      const res = await listFolder(folderId);
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
      const results = await searchAll(searchQuery, folderId);
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

  const toggleSelection = (id: string, type: 'folder' | 'chart', e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItems(prev => {
      const exists = prev.find(item => item.id === id);
      if (exists) return prev.filter(item => item.id !== id);
      return [...prev, { id, type }];
    });
  };

  const RowMenu = ({ id, type, name }: { id: string, type: 'folder' | 'chart', name: string }) => {
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
                setDropdownDirection('down'); // 3 dot problem
              }
              if (rect.left < 200) {
                setDropdownHorizontal('left');
              } else {
                setDropdownHorizontal('right');
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
          <div className={`absolute ${dropdownHorizontal === 'right' ? 'right-0' : 'left-0'} ${dropdownDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} w-48 bg-surface-raised rounded-xl shadow-popover z-20 border border-border py-1`}>
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
                onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); exportChart(id); }}
                className="flex items-center w-full px-4 py-2 text-xs uppercase tracking-widest font-bold text-text-secondary hover:bg-white/5 hover:text-white"
              >
                <Download size={14} className="mr-2" /> Export
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
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          {folderId && (
            <button
              onClick={() => router.push('/')}
              className="p-3 text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all"
              title="Back"
            >
              <CornerLeftUp size={20} />
            </button>
          )}
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            {folderName || 'My Library'}
          </h1>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <button onClick={handleCreateFolder} className="p-3 bg-surface border border-border rounded-xl text-text-secondary hover:text-white hover:bg-surface-raised transition-all flex items-center justify-center font-bold text-sm" title="New Folder">
            <FolderPlus size={18} className="mr-2 sm:mr-0" />
            <span className="sm:hidden">New Folder</span>
          </button>
          <button onClick={handleCreateChart} className="p-3 bg-accent-gradient rounded-xl text-white shadow-md hover:brightness-110 transition-all flex items-center justify-center font-bold text-sm" title="New Chart">
            <FilePlus size={18} className="mr-2 sm:mr-0" />
            <span className="sm:hidden">New Chart</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-8 max-w-md">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-text-secondary" />
        </div>
        <input
          type="text"
          className="block w-full pl-12 pr-4 py-3 bg-surface border border-border rounded-xl leading-5 text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-solid transition-all font-medium shadow-inner"
          placeholder={folderId ? "Search in this folder..." : "Search all charts..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* List View */}
      {/* Grid View */}
      <div className="pt-4 pb-20">
        {loading && !isSearching ? (
          <div className="p-12 text-center text-text-secondary font-medium">Loading...</div>
        ) : isSearching ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {searchResults.length === 0 ? (
              <div className="col-span-full p-12 text-center text-text-secondary font-medium">No charts found matching "{searchQuery}"</div>
            ) : (
              searchResults.map((chart) => (
                <div
                  key={chart.id}
                  className={`bg-surface border rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer group relative transition-all duration-200 ${
                    selectedItems.some(i => i.id === chart.id) ? 'border-accent-solid shadow-md bg-surface-raised before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-accent-gradient before:rounded-l-xl' : 'border-border shadow-sm hover:shadow-hover hover:-translate-y-1'
                  }`}
                  onClick={() => router.push(`/chart/${chart.id}`)}
                >
                  <div className="absolute top-3 left-3 z-10" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedItems.some(i => i.id === chart.id)}
                      onChange={() => {}}
                      onClick={(e) => toggleSelection(chart.id, 'chart', e)}
                      className="w-4 h-4 rounded border-border text-accent-solid focus:ring-accent-solid bg-transparent"
                    />
                  </div>
                  <div className="absolute top-2 right-2 z-10" onClick={e => e.stopPropagation()}>
                    <RowMenu id={chart.id} type="chart" name={chart.title} />
                  </div>
                  <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mb-4 mt-2 shadow-inner border border-border">
                    <FileText size={24} className="text-accent-start" />
                  </div>
                  <p className="text-sm font-bold text-text-primary text-center w-full truncate">{chart.title}</p>
                  <p className="text-[10px] text-text-secondary mt-1">{new Date(chart.updated_at).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
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
                  <div
                    key={folder.id}
                    className={`bg-surface border rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer group relative transition-all duration-200 ${
                      selectedItems.some(i => i.id === folder.id) ? 'border-accent-solid shadow-md bg-surface-raised before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-accent-gradient before:rounded-l-xl' : 'border-border shadow-sm hover:shadow-hover hover:-translate-y-1'
                    }`}
                    onClick={() => router.push(`/folder/${folder.id}`)}
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
                ))}
                
                {charts.map(chart => (
                  <div
                    key={chart.id}
                    className={`bg-surface border rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer group relative transition-all duration-200 ${
                      selectedItems.some(i => i.id === chart.id) ? 'border-accent-solid shadow-md bg-surface-raised before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-accent-gradient before:rounded-l-xl' : 'border-border shadow-sm hover:shadow-hover hover:-translate-y-1'
                    }`}
                    onClick={() => router.push(`/chart/${chart.id}`)}
                  >
                    <div className="absolute top-3 left-3 z-10" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedItems.some(i => i.id === chart.id)}
                        onChange={() => {}}
                        onClick={(e) => toggleSelection(chart.id, 'chart', e)}
                        className="w-4 h-4 rounded border-border text-accent-solid focus:ring-accent-solid bg-transparent"
                      />
                    </div>
                    <div className="absolute top-2 right-2 z-10" onClick={e => e.stopPropagation()}>
                      <RowMenu id={chart.id} type="chart" name={chart.title} />
                    </div>
                    <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mb-4 mt-2 shadow-inner border border-border">
                      <FileText size={24} className="text-accent-start" />
                    </div>
                    <p className="text-sm font-bold text-text-primary text-center w-full truncate">{chart.title}</p>
                    <p className="text-[10px] text-text-secondary mt-1">{new Date(chart.updated_at).toLocaleDateString()}</p>
                  </div>
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
            <p className="text-xs text-text-secondary mb-4">
              Type <strong className="text-text-primary select-all">delete {deleteItem.name}</strong> to confirm.
            </p>
            <input
              autoFocus
              placeholder={`delete ${deleteItem.name}`}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-4 py-3 bg-surface-raised border border-border shadow-inner rounded-xl text-text-primary focus:outline-none focus:border-red-500 transition-colors mb-6 font-medium text-center"
            />
            <div className="flex justify-center space-x-4">
              <button onClick={() => { setDeleteItem(null); setDeleteConfirmText(''); }} className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all">Cancel</button>
              <button 
                onClick={() => executeDelete(false)} 
                disabled={deleteConfirmText !== `delete ${deleteItem.name}`}
                className="px-4 py-2.5 text-sm font-bold text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Move to Trash
              </button>
              <button 
                onClick={() => executeDelete(true)} 
                disabled={deleteConfirmText !== `delete ${deleteItem.name}`}
                className="px-4 py-2.5 text-sm font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl shadow-md hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            <p className="text-xs text-text-secondary mb-4">
              Type <strong className="text-text-primary select-all">delete {selectedItems.length} items</strong> to confirm.
            </p>
            <input
              autoFocus
              placeholder={`delete ${selectedItems.length} items`}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-4 py-3 bg-surface-raised border border-border shadow-inner rounded-xl text-text-primary focus:outline-none focus:border-red-500 transition-colors mb-6 font-medium text-center"
            />
            <div className="flex justify-center space-x-3">
              <button onClick={() => { setBulkDeleteModal(false); setDeleteConfirmText(''); }} className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all">Cancel</button>
              <button 
                onClick={() => handleBulkDelete(false)} 
                disabled={deleteConfirmText !== `delete ${selectedItems.length} items`}
                className="px-4 py-2.5 text-sm font-bold text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Move to Trash
              </button>
              <button 
                onClick={() => handleBulkDelete(true)} 
                disabled={deleteConfirmText !== `delete ${selectedItems.length} items`}
                className="px-4 py-2.5 text-sm font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl shadow-md hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                await createFolder(folderId, name.trim());
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
