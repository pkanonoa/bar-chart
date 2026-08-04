'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useChartSync } from '@/hooks/useChartSync';
import { useParams, useRouter } from 'next/navigation';
import { X, Edit2, Folder as FolderIcon, MoreVertical, Printer, CornerLeftUp, Trash2 } from 'lucide-react';
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { ChartData } from '@/lib/chart-types';
import { transposeChart } from '@/lib/transpose';
import { FolderPickerModal } from '@/components/FolderPickerModal';
import { moveEntry, deleteEntry, moveToTrash } from '@/lib/storage';
import { ChartRenderer } from '@/components/ChartRenderer';

function ChartContentWrapper({ chart, showUI, collaborators, watermark, selectedFont }: any) {
  const { zoomToElement } = useControls();
  const lastTap = React.useRef(0);

  React.useEffect(() => {
    let timeoutId: any;
    const fitToScreen = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        zoomToElement("chart-card", undefined, 0);
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
      zoomToElement("chart-card", undefined, 300);
      lastTap.current = 0;
      e.stopPropagation();
    } else {
      lastTap.current = now;
    }
  };

  return (
    <ChartRenderer
      chart={chart}
      showUI={showUI}
      collaborators={collaborators}
      watermark={watermark}
      selectedFont={selectedFont}
      onClick={handleTap}
    />
  );
}

export default function ChartViewer() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const chartId = params.id as string;

  const { chart, loading: chartLoading, collaborators, updateChart } = useChartSync(chartId);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedFont, setSelectedFont] = useState('system');
  const [watermark, setWatermark] = useState('');
  const [showUI, setShowUI] = useState(false);

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('ui-visibility-change', { detail: showUI }));
    return () => { window.dispatchEvent(new CustomEvent('ui-visibility-change', { detail: true })); };
  }, [showUI]);

  React.useEffect(() => {
    const updateFont = () => {
      const savedFont = localStorage.getItem('chord-grid-font');
      if (savedFont) setSelectedFont(savedFont);
    };
    updateFont();
    window.addEventListener('chord-grid-font-change', updateFont);
    return () => window.removeEventListener('chord-grid-font-change', updateFont);
  }, []);

  React.useEffect(() => {
    const updateWatermark = () => {
      const saved = localStorage.getItem('chord-grid-watermark');
      setWatermark(saved || '');
    };
    updateWatermark();
    window.addEventListener('chord-grid-watermark-change', updateWatermark);
    return () => window.removeEventListener('chord-grid-watermark-change', updateWatermark);
  }, []);

  const handleTranspose = (delta: number) => {
    if (!chart) return;
    updateChart(transposeChart(chart, delta, chart.prefer_flats));
  };

  const handleMoveChart = async (newFolderId: string | null) => {
    if (!chart) return;
    await moveEntry(chart.id, 'chart', newFolderId);
    updateChart({ folder_id: newFolderId });
  };

  if (authLoading || chartLoading) {
    return <div className="flex h-screen items-center justify-center text-white">Loading...</div>;
  }
  if (!user || !chart) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-white">
        <p>Chart not found or access denied.</p>
        <button onClick={() => router.push('/')} className="mt-4 px-4 py-2 bg-indigo-600 rounded-md">Go Home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col text-text-primary relative" onClick={() => setShowUI(!showUI)}>

      {/* Back */}
      <div className={`fixed top-4 left-4 z-40 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); router.push(chart.folder_id ? `/folder/${chart.folder_id}` : '/'); }}
          className="p-3 text-text-secondary bg-surface border border-border rounded-xl shadow-md hover:text-white hover:bg-surface-raised transition-all"
          title="Back"
        >
          <CornerLeftUp size={20} />
        </button>
      </div>

      {/* Top-right controls */}
      <div className={`fixed top-4 right-4 z-40 flex items-center space-x-2 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>

        {/* Compact Transpose */}
        <div className="flex items-center space-x-1 bg-surface-raised shadow-inner border border-border rounded-xl px-2 py-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleTranspose(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-all font-bold text-lg">−</button>
          <span className="text-[10px] font-bold tracking-widest text-accent-start w-10 text-center uppercase">
            {chart.semitone_offset === 0 ? 'Orig' : `${chart.semitone_offset > 0 ? '+' : ''}${chart.semitone_offset}`}
          </span>
          <button onClick={() => handleTranspose(1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-all font-bold text-lg">+</button>
        </div>

        {/* Edit */}
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/chart/${chart.id}/edit`); }}
          className="w-11 h-11 flex items-center justify-center text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all"
          title="Edit Chart"
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
              <button onClick={() => { setIsMenuOpen(false); setIsFolderPickerOpen(true); }} className="w-full flex items-center px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-white/5 hover:text-white">
                <FolderIcon size={16} className="mr-3" /> Move to Folder
              </button>
              <button onClick={() => { setIsMenuOpen(false); window.print(); }} className="w-full flex items-center px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-white/5 hover:text-white">
                <Printer size={16} className="mr-3" /> Export to PDF
              </button>
              <button onClick={() => { setIsMenuOpen(false); setIsDeleteModalOpen(true); }} className="w-full flex items-center px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300">
                <Trash2 size={16} className="mr-3" /> Delete Chart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main canvas */}
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
          } catch (err) { console.log("Fullscreen API error:", err); }
        }}
      >
        <TransformWrapper
          initialScale={1} minScale={0.1} maxScale={5}
          centerOnInit={true} centerZoomedOut={true}
          wheel={{ step: 0.1 }} pinch={{ step: 5 }}
          doubleClick={{ disabled: true }}
        >
          <TransformComponent
            wrapperClass="!w-full !h-screen print:!h-auto"
            contentClass="w-max min-w-full min-h-screen print:min-h-0 flex items-start justify-center p-4 sm:p-12 pt-16 sm:pt-24 print:pt-32 pb-24"
          >
            <ChartContentWrapper chart={chart} showUI={showUI} collaborators={collaborators} watermark={watermark} selectedFont={selectedFont} />
          </TransformComponent>
        </TransformWrapper>
      </main>

      {isFolderPickerOpen && (
        <FolderPickerModal isOpen={true} onClose={() => setIsFolderPickerOpen(false)}
          onMoveHere={(id) => { handleMoveChart(id); setIsFolderPickerOpen(false); }}
          title="Move Chart to..." />
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl p-8 w-full max-w-sm shadow-popover border border-border text-center">
            <div className="w-16 h-16 mx-auto bg-surface-raised shadow-inner border border-border rounded-full flex items-center justify-center mb-6">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-3">Delete Chart?</h3>
            <p className="text-sm text-text-secondary mb-4 font-medium px-4">
              Are you sure you want to delete "{chart.title || 'Untitled Chart'}"?
            </p>
            <div className="flex justify-center space-x-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all">Cancel</button>
              <button onClick={async () => { await moveToTrash(chart.id, 'chart'); router.push(chart.folder_id ? `/folder/${chart.folder_id}` : '/'); }}
                className="px-4 py-2.5 text-sm font-bold text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all">Move to Trash</button>
              <button onClick={async () => { await deleteEntry(chart.id, 'chart'); router.push(chart.folder_id ? `/folder/${chart.folder_id}` : '/'); }}
                className="px-4 py-2.5 text-sm font-bold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl shadow-md hover:bg-red-500 hover:text-white transition-all">Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
