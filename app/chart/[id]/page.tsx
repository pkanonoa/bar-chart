'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { useChartSync } from '@/hooks/useChartSync';
import { useParams, useRouter } from 'next/navigation';
import { parseChord } from '@/lib/chord-parser';
import { Cloud, CornerLeftUp, Edit2, Folder as FolderIcon, MoreVertical, Type, X, Printer } from 'lucide-react';
import { ChartData } from '@/lib/chart-types';
import { transposeChart } from '@/lib/transpose';
import { FolderPickerModal } from '@/components/FolderPickerModal';
import { moveEntry } from '@/lib/storage';

export default function ChartViewer() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const chartId = params.id as string;
  
  const { chart, loading: chartLoading, collaborators, updateChart } = useChartSync(chartId);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedFont, setSelectedFont] = useState('system');
  const [showUI, setShowUI] = useState(false);

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
        <pre className="font-mono text-accent-start font-medium text-[10px] sm:text-xs md:text-[15px] leading-normal whitespace-pre min-w-max" style={selectedFont !== 'system' ? { fontFamily: selectedFont } : {}}>
          {chartData.custom_text}
        </pre>
      );
    }

    const maxLabelLen = Math.max(...chartData.lines.map(l => l.label ? l.label.length : 0));
    const labelCh = Math.max(4, maxLabelLen) + 3; // +3 to account for colon and pr-2 padding
    
    const maxLabelRightLen = Math.max(...chartData.lines.map(l => l.labelRight ? l.labelRight.length : 0));
    const labelRightCh = Math.max(4, maxLabelRightLen) + 3;

    return (
      <div 
        className="flex flex-col gap-4 font-mono w-full leading-relaxed text-text-primary print-reset-scale" 
        style={{ 
          ...(selectedFont !== 'system' ? { fontFamily: selectedFont } : {}),
          fontSize: 'clamp(0.5rem, 1.8vw, 1.25rem)' // Dynamic font scaling to fit screen!
        }}
      >
        {/* Header */}
        <div className="flex flex-col items-center justify-center mb-4 sm:mb-8 pb-4 border-b border-border w-full text-text-primary">
          <h1 className="text-xl sm:text-3xl font-sans font-bold tracking-wider uppercase mb-3" style={{ fontSize: 'clamp(1rem, 3vw, 1.875rem)' }}>{chartData.title || 'Untitled Chart'}</h1>
          <div className="flex gap-6 font-sans font-semibold text-text-secondary tracking-widest" style={{ fontSize: 'clamp(0.6rem, 1.2vw, 0.875rem)' }}>
            <span>{chartData.time_sig || '4/4'}</span>
            <span>T={chartData.tempo || 120}</span>
          </div>
        </div>

        {/* Lines */}
        <div className="flex flex-col gap-3 sm:gap-4 w-full">
          {chartData.lines.map((line, lIdx) => {
            return (
              <div key={lIdx} className="flex flex-row items-center w-full flex-nowrap whitespace-nowrap">
                {/* Label */}
                {maxLabelLen > 0 && (
                  <div 
                    className="shrink-0 text-text-secondary font-sans font-bold uppercase tracking-wider text-right pr-2"
                    style={{ width: `${labelCh}ch` }}
                  >
                    {line.label ? `${line.label}:` : ''}
                  </div>
                )}

                {/* Content */}
                <div className="flex items-center flex-nowrap shrink-0">
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
                        <span className={`inline-block w-[4ch] shrink-0 text-left font-semibold ${prefix.includes('||') ? 'text-accent-gradient' : 'text-text-secondary'}`}>{prefix}</span>
                        {block.bars.map((bar, barIdx) => (
                          <React.Fragment key={barIdx}>
                            <span className="inline-block w-[5ch] shrink-0 text-center font-bold hover:text-accent-start transition-colors duration-150 text-text-primary">
                              {parseChord(bar || '_')}
                            </span>
                            {barIdx < block.bars.length - 1 && (
                              <span className="inline-block w-[2ch] shrink-0 text-center text-text-secondary font-light">|</span>
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
                      <span className={`inline-block w-auto shrink-0 text-left font-semibold ${suffix.includes('||') ? 'text-accent-gradient' : 'text-text-secondary'}`}>
                        {suffix}
                      </span>
                    );
                  })()}
                </div>
                
                {/* Right Label */}
                {maxLabelRightLen > 0 && (
                  <div 
                    className="shrink-0 text-text-secondary font-sans font-bold uppercase tracking-wider text-left pl-2"
                    style={{ width: `${labelRightCh}ch` }}
                  >
                    {line.labelRight ? `${line.labelRight}` : ''}
                  </div>
                )}
              </div>
            );
          })}
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
    return <div className="flex h-screen items-center justify-center bg-gray-950 text-white">Loading...</div>;
  }

  if (!user || !chart) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-950 text-white">
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
            </div>
          )}
        </div>
      </div>

      <main 
        className="flex-1 w-full min-w-0 flex flex-col items-center justify-start p-4 pt-16 sm:p-12 sm:pt-20 overflow-x-hidden cursor-pointer"
        onClick={(e) => {
          // If clicking exactly on the main bg or the container, toggle UI
          setShowUI(!showUI);
        }}
      >
        <div 
          className="w-full max-w-5xl p-6 sm:p-12 bg-surface border border-border shadow-card rounded-3xl overflow-x-auto min-h-[60vh] flex flex-col relative"
        >
          {renderTextFlow(chart)}

          {/* Footer Info */}
          <div className={`mt-auto pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] text-text-secondary font-bold tracking-widest uppercase transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="flex items-center space-x-4">
              <span className="flex items-center text-accent-start"><Cloud size={14} className="mr-2" /> Live Sync</span>
              {collaborators.length > 0 && (
                <span className="text-accent-solid">
                  {collaborators.length} viewing
                </span>
              )}
            </div>
            <span>
              {chart.lines.length} lines • {chart.lines.reduce((sum, line) => sum + line.blocks.reduce((bSum, block) => bSum + block.bars.length, 0), 0)} bars total
            </span>
          </div>
        </div>
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
    </div>
  );
}
