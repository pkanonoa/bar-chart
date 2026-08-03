'use client';

import { useAuth } from '@/components/AuthProvider';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { useParams, useRouter } from 'next/navigation';
import { moveEntry } from '@/lib/storage';
import { FolderPickerModal } from '@/components/FolderPickerModal';
import { CornerLeftUp, Folder as FolderIcon, RefreshCw, Cloud, CloudOff, Copy } from 'lucide-react';
import React, { useState } from 'react';

export default function LyricsEditor() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const lyricId = params.id as string;
  
  const { lyric, loading: lyricLoading, saveStatus, collaborators, updateLyric, forceSave } = useLyricsSync(lyricId);
  const [copied, setCopied] = useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);

  if (authLoading || lyricLoading) {
    return <div className="flex h-screen items-center justify-center text-white">Loading...</div>;
  }

  if (!user || !lyric) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-white">
        <p>Lyrics not found or access denied.</p>
        <button onClick={() => router.push('/lyrics')} className="mt-4 px-4 py-2 bg-indigo-600 rounded-md">Go Home</button>
      </div>
    );
  }

  const handleMoveLyrics = async (newFolderId: string | null) => {
    await moveEntry(lyric.id, 'lyrics', newFolderId);
    updateLyric({ folder_id: newFolderId });
  };

  const copyAsText = () => {
    navigator.clipboard.writeText(`${lyric.title}\n\n${lyric.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col text-text-primary relative pb-32">
      <main className="flex-1 overflow-x-hidden p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Top Bar for buttons */}
          <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <button 
              onClick={async () => {
                await forceSave();
                router.push(`/lyrics/${lyric.id}`);
              }}
              className="px-4 py-2 text-sm font-bold tracking-widest uppercase text-text-secondary hover:text-white bg-surface border border-border shadow-md rounded-xl hover:bg-surface-raised flex items-center transition-all"
            >
              <CornerLeftUp size={16} className="mr-2" /> Back to Viewer
            </button>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => setIsFolderPickerOpen(true)}
                className="px-4 py-2 text-sm font-bold tracking-widest uppercase text-text-secondary hover:text-white bg-surface border border-border shadow-md rounded-xl hover:bg-surface-raised flex items-center transition-all"
              >
                <FolderIcon size={16} className="mr-2" /> Move
              </button>
              
              {/* Network Sync Status */}
              {collaborators.length > 0 && (
                <div className="flex -space-x-2">
                  {collaborators.map((email, idx) => (
                    <div key={idx} className="h-8 w-8 rounded-full bg-surface-raised border border-accent-solid shadow-inner flex items-center justify-center text-xs font-bold text-accent-start" title={`${email} is editing`}>
                      {email.charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center text-[10px] font-bold tracking-widest uppercase bg-surface-raised border border-border shadow-inner rounded-xl px-4 py-2 h-full">
                {saveStatus === 'saving' && <span className="text-text-secondary flex items-center"><RefreshCw size={14} className="mr-2 animate-spin" /> Saving</span>}
                {saveStatus === 'saved' && <span className="text-accent-solid flex items-center"><Cloud size={14} className="mr-2" /> Saved</span>}
                {saveStatus === 'offline' && <span className="text-red-500 flex items-center"><CloudOff size={14} className="mr-2" /> Offline</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 bg-surface border border-border shadow-card rounded-3xl p-6 sm:p-10 w-full">
            <div>
              <label className="block text-xs font-bold tracking-widest text-text-secondary uppercase mb-2">Title</label>
              <input 
                value={lyric.title || ''}
                onChange={e => updateLyric({ title: e.target.value })}
                className="bg-surface-raised border border-border shadow-inner rounded-xl px-4 py-3 text-lg sm:text-2xl font-bold text-text-primary focus:outline-none focus:border-accent-solid w-full transition-all"
                placeholder="Untitled Lyrics"
              />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest text-text-secondary uppercase mb-2">Lyrics Body</label>
              <textarea 
                className="w-full h-[50vh] bg-surface-raised border border-border shadow-inner rounded-2xl p-6 font-sans text-[15px] sm:text-[17px] text-text-primary font-medium whitespace-pre-wrap resize-y focus:outline-none focus:border-accent-solid transition-all leading-relaxed"
                value={lyric.body || ''}
                onChange={e => updateLyric({ body: e.target.value })}
                placeholder="Type lyrics here..."
                spellCheck={false}
              />
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={copyAsText}
                className="px-6 py-3 bg-accent-gradient shadow-md text-white hover:brightness-110 rounded-xl transition-all text-sm font-bold tracking-widest uppercase flex items-center"
              >
                {copied ? 'Copied!' : <><Copy size={16} className="mr-2" /> Copy All</>}
              </button>
            </div>
          </div>
        </div>
      </main>
      
      {isFolderPickerOpen && (
        <FolderPickerModal
          isOpen={true}
          onClose={() => setIsFolderPickerOpen(false)}
          onMoveHere={(id) => {
            handleMoveLyrics(id);
            setIsFolderPickerOpen(false);
          }}
          title="Move Lyrics to..."
          excludeIds={[]}
        />
      )}
    </div>
  );
}
