'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { useChartSync } from '@/hooks/useChartSync';
import { useParams, useRouter } from 'next/navigation';
import { parseChord } from '@/lib/chord-parser';
import { X, Plus, LogOut, Download, Copy, RefreshCw, Cloud, CloudOff, Edit2, Folder as FolderIcon, MoreVertical, Printer, CornerLeftUp, Trash2 } from 'lucide-react';
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { ChartData } from '@/lib/chart-types';
import { transposeChart } from '@/lib/transpose';
import { FolderPickerModal } from '@/components/FolderPickerModal';
import { moveEntry, deleteEntry, moveToTrash } from '@/lib/storage';

function ChartContent({ chart, showUI, collaborators, renderTextFlow }: any) {
  const { zoomToElement } = useControls();
  const lastTap = React.useRef(0);

  React.useEffect(() => {
    let timeoutId: any;

    const fitToScreen = () => {
      clearTimeout(timeoutId);
      // Wait for mobile browser layout reflow after rotation
      timeoutId = setTimeout(() => {
        zoomToElement("chart-card", undefined, 0);
      }, 200);
    };

    // Auto-fit on load
    fitToScreen();

    // Re-fit when screen rotates or resizes
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
      // Double tap detected! Zoom back to fit screen
      zoomToElement("chart-card", undefined, 300);
      lastTap.current = 0;
      // Stop bubbling so the double tap doesn't ALSO toggle the UI on the second tap
      e.stopPropagation();
    } else {
      lastTap.current = now;
    }
  };

  return (
    <div 
      id="chart-card"
      onClick={handleTap}
      className="inline-flex text-left flex-col w-max min-w-[min(100%,64rem)] max-w-none p-6 sm:p-12 print:p-0 bg-surface print:bg-transparent border border-border print:border-none shadow-card print:shadow-none rounded-3xl print:rounded-none relative"
    >
      {renderTextFlow(chart)}

      {/* Footer Info */}
      <div className={`print:hidden mt-auto pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] text-text-secondary font-bold tracking-widest uppercase transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center space-x-4">
          <span className="flex items-center text-accent-start"><Cloud size={14} className="mr-2" /> Live Sync</span>
          {collaborators.length > 0 && (
            <span className="text-accent-solid">
              {collaborators.length} viewing
            </span>
          )}
        </div>
        <span>
          {chart.lines.length} lines • {chart.lines.reduce((sum: number, line: any) => sum + line.blocks.reduce((bSum: number, block: any) => bSum + block.bars.length, 0), 0)} bars total
        </span>
      </div>
    </div>
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
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [selectedFont, setSelectedFont] = useState('system');
  const [showUI, setShowUI] = useState(false);

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
    return () => window.removeEventListener('chord-grid-font-change', updateFont);
  }, []);


  const renderTextFlow = React.useCallback((chartData: ChartData) => {
    if (!chartData) return null;
    if (chartData.custom_text !== undefined && chartData.custom_text !== null) {
      return (
        <pre className="font-sans text-accent-start font-medium text-[10px] sm:text-xs md:text-[15px] leading-normal whitespace-pre min-w-max" style={selectedFont !== 'system' ? { fontFamily: selectedFont } : {}}>
          {chartData.custom_text}
        </pre>
      );
    }

    const maxLabelLen = Math.max(...chartData.lines.map(l => l.label ? l.label.length : 0));
    const labelCh = Math.max(4, maxLabelLen) + 4; 
    
    const maxLabelRightLen = Math.max(...chartData.lines.map(l => l.labelRight ? l.labelRight.length : 0));
    const labelRightCh = Math.max(4, maxLabelRightLen) + 2;

    return (
      <div 
        className="flex flex-col gap-4 font-sans print:!font-mono w-max min-w-full leading-relaxed text-text-primary print-reset-scale print:text-black" 
        style={selectedFont !== 'system' ? { fontFamily: selectedFont } : {}}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center mb-6 sm:mb-10 pb-4 border-b border-border print:border-none w-full text-text-primary print:text-black">
          <div className="flex items-baseline gap-4 sm:gap-6">
            <h1 className="text-2xl sm:text-4xl print:text-4xl font-bold print:!font-bold tracking-wide print:!tracking-normal">{chartData.title || 'Untitled Chart'}</h1>
            <span className="font-semibold print:!font-normal text-lg sm:text-2xl print:text-2xl">{chartData.time_sig || '4/4'}</span>
          </div>
          <div className="absolute right-0 font-semibold print:!font-normal text-base sm:text-xl print:text-xl">
            t={chartData.tempo || 120}
          </div>
        </div>

        {/* Lines */}
        <div className="flex flex-col w-full">
          <div className="flex flex-col gap-4 sm:gap-6 print:gap-[2em] w-fit mx-auto print:mx-0 overflow-x-visible">
            {chartData.lines.map((line, lIdx) => {
              if (line.blocks.length === 0) {
                return (
                  <div key={lIdx} className="flex flex-row items-center w-full flex-nowrap whitespace-nowrap">
                    {/* Left Label */}
                    {line.label ? (
                      <div 
                        className="shrink-0 text-text-primary print:text-black text-base sm:text-xl print:text-[1em] text-right pr-2 sm:pr-4 flex items-center justify-end"
                        style={{ width: `${labelCh}ch` }}
                      >
                        {line.label.charAt(0).toUpperCase()}{line.label.slice(1).toLowerCase()}:
                      </div>
                    ) : (
                      <div className="shrink-0" style={{ width: `${labelCh}ch` }}></div>
                    )}

                    {/* Right Label (Annotation) */}
                    {line.labelRight && (
                      <div 
                        className="shrink-0 text-text-primary print:text-black text-base sm:text-xl print:text-[1em] text-left pl-3 sm:pl-6 flex items-center ml-auto"
                        style={{ width: `${labelRightCh}ch` }}
                      >
                        {line.labelRight}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={lIdx} className="flex flex-row items-center flex-nowrap whitespace-nowrap">
                  {/* Left Label */}
                  <div 
                    className="shrink-0 text-text-primary print:text-black text-base sm:text-xl print:text-[1em] text-right pr-2 sm:pr-4 flex items-center justify-end"
                    style={{ width: `${labelCh}ch` }}
                  >
                    {line.label ? `${line.label.charAt(0).toUpperCase()}${line.label.slice(1).toLowerCase()}:` : ''}
                  </div>

                  {/* Chords Container */}
                  <div className="flex items-center flex-nowrap shrink-0 text-lg sm:text-2xl print:text-[1.1em]">
                    {line.blocks.map((block, bIdx) => {
                      const isFirst = bIdx === 0;
                      let prefix = '';
                      if (isFirst) {
                        prefix = block.startRepeat ? '||:' : '||';
                      } else {
                        const prevBlock = line.blocks[bIdx - 1];
                        if (prevBlock.endRepeat && block.startRepeat) {
                          prefix = ':||:';
                        } else if (prevBlock.endRepeat) {
                          prefix = ':||';
                        } else if (block.startRepeat) {
                          prefix = '||:';
                        } else {
                          prefix = '||';
                        }
                      }

                      const isLast = bIdx === line.blocks.length - 1;
                      let suffix = '';
                      if (isLast) {
                        suffix = block.endRepeat ? ':||' : '||';
                      }

                      return (
                        <React.Fragment key={bIdx}>
                          <span className={`inline-block pr-2 sm:pr-3 text-left tracking-tighter print:!tracking-normal print:!font-normal print:!text-[1em] ${prefix.includes('||') ? 'text-cyan-400 font-black text-[1.2em] print:text-black' : 'text-text-primary font-semibold print:text-black'}`}>{prefix}</span>
                          {block.bars.map((bar, barIdx) => (
                            <React.Fragment key={barIdx}>
                              <span className="inline-block px-1.5 sm:px-2.5 text-center font-bold print:!font-semibold hover:text-accent-start transition-colors duration-150 text-text-primary print:text-black">
                                {parseChord(bar || '_')}
                              </span>
                              {barIdx < block.bars.length - 1 && (
                                <span className="inline-block px-1.5 sm:px-2.5 text-center text-text-primary print:text-black print:!font-normal print:!tracking-normal">|</span>
                              )}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      );
                    })}

                    {/* Final Suffix */}
                    {line.blocks.length > 0 && (() => {
                      const lastBlock = line.blocks[line.blocks.length - 1];
                      const suffix = lastBlock.endRepeat ? ':||' : '||';
                      return (
                        <span className={`inline-block pl-2 sm:pl-3 text-left tracking-tighter print:!tracking-normal print:!font-normal print:!text-[1em] ${suffix.includes('||') ? 'text-cyan-400 font-black text-[1.2em] print:text-black' : 'text-text-primary font-semibold print:text-black'}`}>
                          {suffix}
                        </span>
                      );
                    })()}
                  </div>
                  
                  {/* Right Label */}
                  {maxLabelRightLen > 0 && (
                    <div 
                      className="shrink-0 text-text-primary print:text-black text-base sm:text-xl print:text-[1em] text-left pl-3 sm:pl-6 flex items-center"
                      style={{ width: `${labelRightCh}ch` }}
                    >
                      {line.labelRight}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }, [selectedFont]);

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
      
      {/* Floating Controls */}
      <div className={`fixed top-4 left-4 z-40 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <button 
          onClick={(e) => { e.stopPropagation(); router.push(chart.folder_id ? `/folder/${chart.folder_id}` : '/'); }}
          className="p-3 text-text-secondary bg-surface border border-border rounded-xl shadow-md hover:text-white hover:bg-surface-raised transition-all"
          title="Back"
        >
          <CornerLeftUp size={20} />
        </button>
      </div>

      <div className={`fixed top-4 right-4 z-40 flex items-center space-x-2 transition-opacity duration-300 ${showUI ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Compact Transpose */}
        <div className="flex items-center space-x-1 bg-surface-raised shadow-inner border border-border rounded-xl px-2 py-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleTranspose(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-all font-bold text-lg">−</button>
          <span className="text-[10px] font-bold tracking-widest text-accent-start w-10 text-center uppercase">
            {chart.semitone_offset === 0 ? 'Orig' : `${chart.semitone_offset > 0 ? '+' : ''}${chart.semitone_offset}`}
          </span>
          <button onClick={() => handleTranspose(1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-all font-bold text-lg">+</button>
        </div>

        {/* Edit Button */}
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
                  setDeleteConfirmText('');
                }}
                className="w-full flex items-center px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 size={16} className="mr-3" /> Delete Chart
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
            wrapperClass="!w-full !h-screen" 
            contentClass="w-max min-w-full min-h-screen flex items-center justify-center p-4 sm:p-12 pt-24 pb-24"
          >
            <ChartContent chart={chart} showUI={showUI} collaborators={collaborators} renderTextFlow={renderTextFlow} />
          </TransformComponent>
        </TransformWrapper>
      </main>

      {isFolderPickerOpen && (
        <FolderPickerModal
          isOpen={true}
          onClose={() => setIsFolderPickerOpen(false)}
          onMoveHere={(id) => {
            handleMoveChart(id);
            setIsFolderPickerOpen(false);
          }}
          title="Move Chart to..."
        />
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
            <p className="text-xs text-text-secondary mb-4">
              Type <strong className="text-text-primary select-all">delete {chart.title || 'Untitled Chart'}</strong> to confirm.
            </p>
            <input
              autoFocus
              placeholder={`delete ${chart.title || 'Untitled Chart'}`}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-4 py-3 bg-surface-raised border border-border shadow-inner rounded-xl text-text-primary focus:outline-none focus:border-red-500 transition-colors mb-6 font-medium text-center"
            />
            <div className="flex justify-center space-x-3">
              <button onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); }} className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all">Cancel</button>
              <button 
                onClick={async () => {
                  await moveToTrash(chart.id, 'chart');
                  router.push(chart.folder_id ? `/folder/${chart.folder_id}` : '/');
                }}
                disabled={deleteConfirmText !== `delete ${chart.title || 'Untitled Chart'}`}
                className="px-4 py-2.5 text-sm font-bold text-white bg-accent-gradient rounded-xl shadow-md hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Move to Trash
              </button>
              <button 
                onClick={async () => {
                  await deleteEntry(chart.id, 'chart');
                  router.push(chart.folder_id ? `/folder/${chart.folder_id}` : '/');
                }}
                disabled={deleteConfirmText !== `delete ${chart.title || 'Untitled Chart'}`}
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
