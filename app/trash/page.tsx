'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { listTrash, deleteEntry, restoreFromTrash, Folder, Chart } from '@/lib/storage';
import { useAuth } from '@/components/AuthProvider';
import { Folder as FolderIcon, FileText, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/Header';
import { Navigation } from '@/components/Navigation';

export default function TrashPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [charts, setCharts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [restoreItem, setRestoreItem] = useState<{ id: string, type: 'folder' | 'chart', trashedName: string, originalName: string } | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: string, type: 'folder' | 'chart', originalName: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const loadContents = async () => {
    setLoading(true);
    try {
      const res = await listTrash();
      setFolders(res.folders);
      setCharts(res.charts);
    } catch (err) {
      console.error('Failed to load trash contents', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadContents();
    }
  }, [user, authLoading]);

  const executeDelete = async () => {
    if (deleteItem) {
      await deleteEntry(deleteItem.id, deleteItem.type);
      loadContents();
    }
    setDeleteItem(null);
    setDeleteConfirmText('');
  };

  const executeRestore = async () => {
    if (restoreItem) {
      await restoreFromTrash(restoreItem.id, restoreItem.type, restoreItem.trashedName);
      loadContents();
    }
    setRestoreItem(null);
  };

  const getOriginalName = (trashedName: string) => {
    const parts = trashedName.split(':');
    return parts.length >= 3 ? parts.slice(2).join(':') : trashedName;
  };

  if (authLoading) return <div className="min-h-screen bg-background flex items-center justify-center text-text-secondary font-medium">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-card">
          <AlertTriangle className="w-12 h-12 text-accent-solid mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">Access Denied</h2>
          <p className="text-text-secondary mb-6">Please log in to view your trash.</p>
          <button onClick={() => router.push('/login')} className="w-full py-3 px-4 bg-accent-gradient hover:brightness-110 text-white font-bold rounded-xl transition-all shadow-md">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Navigation />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto w-full custom-scrollbar">
          <div className="w-full max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center mb-10">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mr-4 border border-red-500/20">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h1 className="text-3xl font-bold text-text-primary tracking-tight">Trash</h1>
            </div>

            <div className="pt-4 pb-20">
              {loading ? (
                <div className="p-12 text-center text-text-secondary font-medium">Loading...</div>
              ) : folders.length === 0 && charts.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="mx-auto h-20 w-20 bg-surface-raised rounded-full shadow-inner border border-border flex items-center justify-center mb-6">
                    <Trash2 size={32} className="text-text-secondary opacity-50" strokeWidth={2} />
                  </div>
                  <h3 className="text-sm font-bold text-text-primary mb-2">Trash is empty</h3>
                  <p className="text-xs text-text-secondary">Items you move to trash will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {folders.map(folder => {
                    const originalName = getOriginalName(folder.name);
                    return (
                      <div key={folder.id} className="bg-surface border border-border rounded-xl p-5 flex flex-col items-center justify-center group relative transition-all duration-200 hover:shadow-hover">
                        <div className="absolute top-2 right-2 flex space-x-2">
                          <button onClick={() => setRestoreItem({ id: folder.id, type: 'folder', trashedName: folder.name, originalName })} className="p-2 text-text-secondary hover:text-accent-start rounded-md hover:bg-white/5 transition-colors" title="Restore">
                            <RefreshCw size={18} />
                          </button>
                          <button onClick={() => setDeleteItem({ id: folder.id, type: 'folder', originalName })} className="p-2 text-text-secondary hover:text-red-400 rounded-md hover:bg-red-500/10 transition-colors" title="Delete Permanently">
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mb-4 mt-4 shadow-inner border border-border opacity-60">
                          <FolderIcon size={24} className="text-text-primary opacity-50" fill="currentColor" fillOpacity={0.1} />
                        </div>
                        <p className="text-sm font-bold text-text-primary text-center w-full truncate">{originalName}</p>
                        <p className="text-[10px] text-text-secondary mt-1">Deleted: {new Date(folder.updated_at).toLocaleDateString()}</p>
                      </div>
                    );
                  })}
                  
                  {charts.map(chart => {
                    const originalName = getOriginalName(chart.title);
                    return (
                      <div key={chart.id} className="bg-surface border border-border rounded-xl p-5 flex flex-col items-center justify-center group relative transition-all duration-200 hover:shadow-hover">
                        <div className="absolute top-2 right-2 flex space-x-2">
                          <button onClick={() => setRestoreItem({ id: chart.id, type: 'chart', trashedName: chart.title, originalName })} className="p-2 text-text-secondary hover:text-accent-start rounded-md hover:bg-white/5 transition-colors" title="Restore">
                            <RefreshCw size={18} />
                          </button>
                          <button onClick={() => setDeleteItem({ id: chart.id, type: 'chart', originalName })} className="p-2 text-text-secondary hover:text-red-400 rounded-md hover:bg-red-500/10 transition-colors" title="Delete Permanently">
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mb-4 mt-4 shadow-inner border border-border opacity-60">
                          <FileText size={24} className="text-accent-start" />
                        </div>
                        <p className="text-sm font-bold text-text-primary text-center w-full truncate">{originalName}</p>
                        <p className="text-[10px] text-text-secondary mt-1">Deleted: {new Date(chart.updated_at).toLocaleDateString()}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Restore Modal */}
      {restoreItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-popover border border-border text-center">
            <div className="w-16 h-16 mx-auto bg-surface-raised shadow-inner border border-border rounded-full flex items-center justify-center mb-6">
              <RefreshCw size={24} className="text-accent-start" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-3">Restore {restoreItem.type}?</h3>
            <p className="text-sm text-text-secondary mb-8 font-medium px-4">
              "{restoreItem.originalName}" will be restored to its original location.
            </p>
            <div className="flex justify-center space-x-4">
              <button onClick={() => setRestoreItem(null)} className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all">Cancel</button>
              <button onClick={executeRestore} className="px-6 py-2.5 text-sm font-bold text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all">Restore</button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Modal */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-popover border border-border text-center">
            <div className="w-16 h-16 mx-auto bg-surface-raised shadow-inner border border-border rounded-full flex items-center justify-center mb-6">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-3">Delete Permanently?</h3>
            <p className="text-sm text-text-secondary mb-4 font-medium px-4">
              Are you sure you want to permanently delete "{deleteItem.originalName}"? This action cannot be undone.
            </p>
            <p className="text-xs text-text-secondary mb-4">
              Type <strong className="text-text-primary select-all">delete {deleteItem.originalName}</strong> to confirm.
            </p>
            <input
              autoFocus
              placeholder={`delete ${deleteItem.originalName}`}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-4 py-3 bg-surface-raised border border-border shadow-inner rounded-xl text-text-primary focus:outline-none focus:border-red-500 transition-colors mb-6 font-medium text-center"
            />
            <div className="flex justify-center space-x-4">
              <button onClick={() => { setDeleteItem(null); setDeleteConfirmText(''); }} className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all">Cancel</button>
              <button 
                onClick={executeDelete} 
                disabled={deleteConfirmText !== `delete ${deleteItem.originalName}`}
                className="px-4 py-2.5 text-sm font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl shadow-md hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
