'use client';

import { useState, useEffect } from 'react';
import { listFolder, Folder } from '@/lib/storage';
import { Folder as FolderIcon, X, ChevronRight, CornerLeftUp } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onMoveHere: (folderId: string | null) => void;
  title?: string;
  excludeIds?: string[]; // Do not allow moving a folder into itself
}

export function FolderPickerModal({ isOpen, onClose, onMoveHere, title = "Move to...", excludeIds = [] }: Props) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  // Optional: keep track of navigation history to go back up, or fetch parent. 
  // For simplicity, we just fetch from root if we don't have a robust way, or track breadcrumbs.
  const [history, setHistory] = useState<(string | null)[]>([null]);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setLoading(true);
    
    listFolder(currentFolderId).then(res => {
      if (isMounted) {
        // Exclude the folders we are trying to move
        setFolders(res.folders.filter(f => !excludeIds.includes(f.id)));
        setLoading(false);
      }
    });
    
    return () => { isMounted = false; };
  }, [isOpen, currentFolderId, excludeIds.join(',')]);

  if (!isOpen) return null;

  const navigateUp = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop(); // remove current
    const parent = newHistory[newHistory.length - 1];
    setHistory(newHistory);
    setCurrentFolderId(parent);
  };

  const navigateTo = (id: string) => {
    setHistory([...history, id]);
    setCurrentFolderId(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-0">
      <div className="bg-surface w-full max-w-md rounded-3xl shadow-popover border border-border overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="p-2 text-text-secondary bg-surface-raised border border-border shadow-inner rounded-full hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-3 border-b border-border flex items-center bg-bg">
          {history.length > 1 && (
            <button 
              onClick={navigateUp}
              className="flex items-center text-sm font-semibold text-accent-start hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <CornerLeftUp size={16} className="mr-2" />
              Up to Parent
            </button>
          )}
          {history.length === 1 && (
            <span className="text-sm font-semibold text-text-secondary px-3 py-1.5 flex items-center">
              <FolderIcon size={16} className="mr-2" /> Root
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-text-secondary text-sm font-medium">Loading folders...</div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm font-medium italic">No subfolders here</div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => navigateTo(f.id)}
                  className="w-full flex items-center justify-between p-4 bg-surface border border-border shadow-sm rounded-2xl hover:-translate-y-1 hover:shadow-hover hover:bg-surface-raised transition-all text-left group"
                >
                  <div className="flex items-center text-text-primary font-bold">
                    <FolderIcon size={20} className="mr-4 text-accent-start" fill="currentColor" fillOpacity={0.1} />
                    <span className="truncate">{f.name}</span>
                  </div>
                  <ChevronRight size={18} className="text-text-secondary group-hover:text-white" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border bg-bg flex justify-end space-x-4">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border shadow-sm rounded-xl hover:text-white hover:bg-surface-raised transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onMoveHere(currentFolderId);
              onClose();
            }}
            className="px-6 py-2.5 text-sm font-bold text-white bg-accent-gradient shadow-md rounded-xl hover:brightness-110 transition-all"
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}
