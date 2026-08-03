'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { useParams, useRouter } from 'next/navigation';
import { X, Edit2, Folder as FolderIcon, MoreVertical, Printer, CornerLeftUp, Trash2 } from 'lucide-react';
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { FolderPickerModal } from '@/components/FolderPickerModal';
import { moveEntry, deleteEntry, moveToTrash } from '@/lib/storage';

function LyricsContentWrapper({ lyric, showUI, selectedFont, watermark }: any) {
  const { zoomToElement } = useControls();
  const lastTap = React.useRef(0);

  React.useEffect(() => {
    let timeoutId: any;
    const fitToScreen = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        zoomToElement("lyrics-card", undefined, 0);
      }, 200);
    };

    fitToScreen();
    window.addEventListener('resize', fitToScreen);
    window.addEventListener('orientationchange', fitToScreen);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', fitToScreen);
      window.removeEventListener('orientationchange', fitToScreen);
    };
  }, [zoomToElement]);

  const handleTap = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      zoomToElement("lyrics-card", undefined, 300);
      lastTap.current = 0;
      e.stopPropagation();
    } else {
      lastTap.current = now;
    }
  };

  return (
    <div 
      id="lyrics-card"
      onClick={handleTap}
      className={`inline-flex text-left flex-col w-max min-w-[min(100%,48rem)] max-w-none p-6 sm:p-12 print:p-0 print:ml-24 print:w-full bg-surface print:bg-transparent border border-border print:border-none shadow-card print:shadow-none rounded-3xl print:rounded-none relative select-none print:min-h-[28cm]`}
      style={{
        fontFamily: selectedFont === 'serif' ? 'Georgia, serif' : 
                    selectedFont === 'mono' ? 'monospace' : 
                    'system-ui, -apple-system, sans-serif'
      }}
    >
      {watermark && (
        <div className="hidden print:grid absolute inset-0 grid-cols-4 gap-y-6 gap-x-4 items-center justify-items-center pointer-events-none overflow-hidden z-[1] opacity-[0.04] rotate-[-30deg] scale-150 select-none">
          {Array.from({ length: 80 }).map((_, i) => (
            <span key={i} className="text-base font-bold uppercase tracking-wider text-black whitespace-nowrap">
              {watermark}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-4 w-max min-w-full leading-relaxed text-text-primary print-reset-scale print:text-black">
        <div className="relative flex items-center justify-center mb-6 sm:mb-10 pb-4 border-b border-border print:border-none w-full text-text-primary print:text-black print:pt-24 print:pl-8">
          <h1 className="text-3xl sm:text-4xl print:text-4xl font-bold tracking-wide print:!tracking-normal text-center w-full">
            {lyric?.title || 'Untitled Lyrics'}
          </h1>
        </div>
        <div className="flex flex-col w-full">
          <div className="flex flex-col w-fit mx-auto print:mx-auto overflow-x-visible whitespace-pre-wrap text-lg leading-relaxed print:text-[1.3rem] print:leading-[2] text-center text-text-primary print:text-black">
            {lyric?.body}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LyricsViewer() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const lyricId = params.id as string;
  
  const { lyric, loading: lyricLoading, updateLyric } = useLyricsSync(lyricId);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedFont, setSelectedFont] = useState('system');
  const [showUI, setShowUI] = useState(false);
  const [watermark, setWatermark] = useState('');

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('ui-visibility-change', { detail: showUI }));
    return () => {
      window.dispatchEvent(new CustomEvent('ui-visibility-change', { detail: true }));
    };
  }, [showUI]);

  React.useEffect(() => {
    const updateFont = () => {
      const savedFont = localStorage.getItem('chord-grid-font');
      if (savedFont) setSelectedFont(savedFont);
    };
    updateFont();
    window.addEventListener('chord-grid-font-change', updateFont);

    const updateWatermark = () => {
      const savedWatermark = localStorage.getItem('chord-grid-watermark');
      if (savedWatermark) setWatermark(savedWatermark);
      else setWatermark('');
    };
    updateWatermark();
    window.addEventListener('chord-grid-watermark-change', updateWatermark);

    return () => {
      window.removeEventListener('chord-grid-font-change', updateFont);
      window.removeEventListener('chord-grid-watermark-change', updateWatermark);
    };
  }, []);

  const handleMoveLyrics = async (newFolderId: string | null) => {
    if (!lyric) return;
    await moveEntry(lyric.id, 'lyrics', newFolderId);
    updateLyric({ folder_id: newFolderId });
  };

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

  return (
    <div className="min-h-screen bg-bg flex flex-col text-text-primary relative" onClick={() => setShowUI(!showUI)}>
      
      {/* Floating Controls */}
      <div className={`fixed top-4 left-4 z-40 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <button 
          onClick={(e) => { e.stopPropagation(); router.push(lyric.folder_id ? `/lyrics/folder/${lyric.folder_id}` : '/lyrics'); }}
          className="p-3 text-text-secondary bg-surface border border-border rounded-xl shadow-md hover:text-white hover:bg-surface-raised transition-all"
          title="Back"
        >
          <CornerLeftUp size={20} />
        </button>
      </div>

      <div className={`fixed top-4 right-4 z-40 flex items-center space-x-2 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Edit Button */}
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/lyrics/${lyric.id}/edit`); }}
          className="w-11 h-11 flex items-center justify-center text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all"
          title="Edit Lyrics"
        >
          <Edit2 size={18} />
        </button>

        {/* 3-Dot Menu */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-11 h-11 flex items-center justify-center text-text-secondary bg-surface border border-border shadow-md rounded-xl hover:text-white hover:bg-surface-raised transition-all"
          >
            {isMenuOpen ? <X size={20} /> : <MoreVertical size={20} />}
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-4 w-56 bg-surface-raised shadow-popover border border-border rounded-2xl overflow-hidden py-2">
              <button
                onClick={() => { setIsMenuOpen(false); setIsFolderPickerOpen(true); }}
                className="w-full flex items-center px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-white/5 hover:text-white"
              >
                <FolderIcon size={16} className="mr-3" /> Move to Folder
              </button>
              <button
                onClick={() => { setIsMenuOpen(false); window.print(); }}
                className="w-full flex items-center px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-white/5 hover:text-white"
              >
                <Printer size={16} className="mr-3" /> Export to PDF
              </button>
              <button
                onClick={async () => {
                  setIsMenuOpen(false);
                  setIsDeleteModalOpen(true);
                  }}
                className="w-full flex items-center px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 size={16} className="mr-3" /> Delete Lyrics
              </button>
            </div>
          )}
        </div>
      </div>

      <main 
        className="flex-1 w-full h-full min-h-screen overflow-hidden cursor-pointer"
        onClick={async (e) => {
          const nextState = !showUI;
          setShowUI(nextState);
          try {
            if (!nextState) {
              if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
              }
            } else {
              if (document.exitFullscreen && document.fullscreenElement) {
                await document.exitFullscreen();
              }
            }
          } catch (err) {
            console.log("Fullscreen API error:", err);
          }
        }}
      >
        <TransformWrapper
          initialScale={1}
          minScale={0.1}
          maxScale={5}
          centerOnInit={true}
          centerZoomedOut={true}
          wheel={{ step: 0.1 }}
          pinch={{ step: 5 }}
          doubleClick={{ disabled: true }}
        >
          <TransformComponent 
            wrapperClass="!w-full !h-screen print:!h-auto" 
            contentClass="w-max min-w-full min-h-screen print:min-h-0 flex items-start justify-center p-4 sm:p-12 pt-16 sm:pt-24 print:pt-32 pb-24"
          >
            <LyricsContentWrapper lyric={lyric} showUI={showUI} selectedFont={selectedFont} watermark={watermark} />
          </TransformComponent>
        </TransformWrapper>
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
        />
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-popover border border-border text-center">
            <div className="w-16 h-16 mx-auto bg-surface-raised shadow-inner border border-border rounded-full flex items-center justify-center mb-6">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-3">Delete Lyrics?</h3>
            <p className="text-sm text-text-secondary mb-4 font-medium px-4">
              Are you sure you want to delete "{lyric.title || 'Untitled Lyrics'}"?
            </p>
            <div className="flex justify-center space-x-3">
              <button onClick={() => { setIsDeleteModalOpen(false); }} className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all">Cancel</button>
              <button 
                onClick={async () => {
                  await moveToTrash(lyric.id, 'lyrics');
                  router.push(lyric.folder_id ? `/lyrics/folder/${lyric.folder_id}` : '/lyrics');
                }}
                className="px-4 py-2.5 text-sm font-bold text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all"
              >
                Move to Trash
              </button>
              <button 
                onClick={async () => {
                  await deleteEntry(lyric.id, 'lyrics');
                  router.push(lyric.folder_id ? `/lyrics/folder/${lyric.folder_id}` : '/lyrics');
                }}
                className="px-4 py-2.5 text-sm font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl shadow-md hover:bg-red-500 hover:text-white transition-all"
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
