import React, { useState, useEffect } from 'react';
import { Cloud } from 'lucide-react';
import { parseChord } from '@/lib/chord-parser';
import { ChartData } from '@/lib/chart-types';

/** Renders a bar-line marker (e.g. "||:", ":||:", "||") so that
 *  the || double-bars are black/bold and only the : repeat dots are indigo. */
function BarMarker({ marker, side }: { marker: string; side: 'left' | 'right' }) {
  const barClass = 'text-slate-500 font-medium text-[1.0em] sm:text-[1.1em] print:text-black';
  const dotClass = 'text-indigo-500 font-black text-[1.0em] sm:text-[1.1em] print:text-black';

  // Split into segments: leading ':', '||', trailing ':'
  const parts: { ch: string; isColon: boolean }[] = [];
  let i = 0;
  while (i < marker.length) {
    if (marker[i] === ':') {
      parts.push({ ch: ':', isColon: true });
      i++;
    } else if (marker[i] === '|') {
      // grab the run of | characters
      let run = '';
      while (i < marker.length && marker[i] === '|') { run += marker[i]; i++; }
      parts.push({ ch: run, isColon: false });
    } else {
      i++;
    }
  }

  const pad = side === 'left'
    ? 'inline-flex items-center pr-1.5 sm:pr-2.5 print:pr-1 tracking-tighter'
    : 'inline-flex items-center pl-1.5 sm:pl-2.5 print:pl-1 tracking-tighter';

  return (
    <span className={pad}>
      {parts.map((p, idx) => (
        <span key={idx} className={p.isColon ? dotClass : barClass}>{p.ch}</span>
      ))}
    </span>
  );
}

// Color swatches for individual element popovers
const COLOR_SWATCHES = [
  { name: 'Reset', color: '#0f172a', isReset: true },
  { name: 'Red', color: '#e11d48' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Indigo', color: '#4f46e5' },
  { name: 'Purple', color: '#7c3aed' },
  { name: 'Teal', color: '#0d9488' },
  { name: 'Amber', color: '#d97706' },
  { name: 'Emerald', color: '#059669' },
];

function ColorPickerPopover({
  itemKey,
  activePickerKey,
  onSetColor,
  position = 'above',
}: {
  itemKey: string;
  activePickerKey: string | null;
  onSetColor: (key: string, color: string | null) => void;
  position?: 'above' | 'below' | 'right';
}) {
  if (activePickerKey !== itemKey) return null;

  const posClasses = position === 'below' 
    ? 'top-full mt-2 left-0 z-50' 
    : position === 'right'
    ? 'top-1/2 -translate-y-1/2 left-full ml-3 z-50'
    : '-top-12 left-0 sm:left-1/2 sm:-translate-x-1/2 z-50';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute ${posClasses} flex items-center gap-1.5 p-2 bg-slate-900/95 backdrop-blur-md rounded-full shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150 print:hidden min-w-max`}
    >
      {COLOR_SWATCHES.map((swatch) => (
        <button
          key={swatch.name}
          title={swatch.name}
          onClick={(e) => {
            e.stopPropagation();
            onSetColor(itemKey, swatch.isReset ? null : swatch.color);
          }}
          className={`w-6 h-6 rounded-full border transition-transform hover:scale-125 ${
            swatch.isReset ? 'border-slate-500 bg-slate-800 text-[10px] text-white flex items-center justify-center font-bold' : 'border-white/40 shadow-sm'
          }`}
          style={!swatch.isReset ? { backgroundColor: swatch.color } : {}}
        >
          {swatch.isReset ? '✕' : ''}
        </button>
      ))}
    </div>
  );
}

interface ChartRendererProps {
  chart: ChartData;
  showUI?: boolean;
  collaborators?: any[];
  watermark?: string;
  selectedFont?: string;
  chordColor?: string;
  onClick?: (e: React.MouseEvent) => void;
  id?: string;
  /** Index of the currently active section (for follower highlight) */
  activeSectionIndex?: number;
}

export function ChartRenderer({ 
  chart, 
  showUI = false, 
  collaborators = [], 
  watermark = '',
  selectedFont = 'system',
  chordColor = '#0f172a',
  onClick,
  id = 'chart-card',
  activeSectionIndex,
}: ChartRendererProps) {
  // Individual element color overrides
  const [itemColors, setItemColors] = useState<Record<string, string>>({});
  const [activePickerKey, setActivePickerKey] = useState<string | null>(null);

  useEffect(() => {
    if (!chart?.id) return;
    try {
      const saved = localStorage.getItem(`chord-grid-item-colors-${chart.id}`);
      if (saved) setItemColors(JSON.parse(saved));
    } catch {}
  }, [chart?.id]);

  const handleSetColor = (key: string, color: string | null) => {
    setItemColors((prev) => {
      const updated = { ...prev };
      if (color === null) {
        delete updated[key];
      } else {
        updated[key] = color;
      }
      try {
        if (chart?.id) {
          localStorage.setItem(`chord-grid-item-colors-${chart.id}`, JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });
    setActivePickerKey(null);
  };

  const renderTextFlow = (chartData: ChartData) => {
    if (!chartData) return null;
    if (chartData.custom_text !== undefined && chartData.custom_text !== null) {
      return (
        <pre className="font-sans text-indigo-600 font-medium text-[10px] sm:text-xs md:text-[15px] leading-normal whitespace-pre min-w-max" style={selectedFont !== 'system' ? { fontFamily: selectedFont } : {}}>
          {chartData.custom_text}
        </pre>
      );
    }

    const maxLabelLen = Math.max(...chartData.lines.map(l => l.label ? l.label.length : 0));
    const labelCh = Math.max(7, maxLabelLen + 1); 
    
    const maxLabelRightLen = Math.max(...chartData.lines.map(l => l.labelRight ? l.labelRight.length : 0));
    const labelRightCh = Math.max(4, maxLabelRightLen) + 2;

    return (
      <div 
        className="flex flex-col gap-4 font-sans print:!font-mono w-full leading-relaxed text-slate-900 print-reset-scale print:text-black" 
        style={selectedFont !== 'system' ? { fontFamily: selectedFont } : {}}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center mb-8 sm:mb-12 pb-5 border-b border-slate-200 print:border-none w-full text-slate-900 print:text-black print:pt-24">
          <div className="flex items-baseline gap-4 sm:gap-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold print:!font-bold tracking-tight print:!tracking-normal text-slate-900">{chartData.title || 'Untitled Chart'}</h1>
            <span className="font-bold text-slate-500 print:!font-normal text-xl sm:text-3xl print:text-3xl">{chartData.time_sig || '4/4'}</span>
          </div>
          <div className="absolute right-0 print:right-24 font-bold text-slate-500 print:!font-normal text-lg sm:text-2xl print:text-2xl">
            t={chartData.tempo || 120}
          </div>
        </div>

        {/* Lines */}
        <div className="flex flex-col w-full items-center justify-center">
          <div className="flex flex-col gap-5 sm:gap-8 print:gap-10 w-fit mx-auto print:mx-0 max-w-full overflow-visible scrollbar-none px-2 py-2">
            {chartData.lines.map((line, lIdx) => {
              const secName = line.label ? line.label.trim().toLowerCase() : '';
              const sectionKey = secName ? `section-${secName}` : `label-${lIdx}`;
              const customLabelColor = itemColors[sectionKey] || itemColors[`label-${lIdx}`] || (chordColor !== '#0f172a' ? chordColor : undefined);
              const popoverPos = lIdx === 0 ? 'below' : 'above';

              if (line.blocks.length === 0) {
                return (
                  <div key={lIdx} className={`flex flex-row items-center justify-start w-full flex-nowrap whitespace-nowrap rounded-lg transition-all duration-300 ${
                    activeSectionIndex === lIdx ? 'ring-2 ring-indigo-500/40 bg-indigo-50/50 px-2 -mx-2' : ''
                  }`} id={`chart-line-${lIdx}`}>
                    {/* Left Label */}
                    {line.label ? (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePickerKey(activePickerKey === sectionKey ? null : sectionKey);
                        }}
                        className="relative shrink-0 font-extrabold text-lg sm:text-2xl md:text-3xl print:text-[1em] text-right pr-3 sm:pr-6 flex items-center justify-end font-sans select-none cursor-pointer hover:opacity-75 transition-opacity"
                        style={{ width: `${Math.max(7, labelCh)}ch`, minWidth: '6rem', color: customLabelColor || '#0f172a' }}
                        title="Click to color this section label"
                      >
                        <ColorPickerPopover itemKey={sectionKey} activePickerKey={activePickerKey} onSetColor={handleSetColor} position={popoverPos} />
                        {line.label.charAt(0).toUpperCase()}{line.label.slice(1).toLowerCase()}:
                      </div>
                    ) : (
                      <div className="shrink-0" style={{ width: `${Math.max(7, labelCh)}ch`, minWidth: '6rem' }}></div>
                    )}

                    {/* Right Label (Annotation text after || bar) */}
                    {line.labelRight && (() => {
                      const labelRightKey = `labelRight-${lIdx}-${line.labelRight}`;
                      const customLabelRightColor = itemColors[labelRightKey];
                      return (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePickerKey(activePickerKey === labelRightKey ? null : labelRightKey);
                          }}
                          className="relative shrink-0 font-semibold print:text-black text-lg sm:text-2xl print:text-[1em] text-left pl-3 sm:pl-6 flex items-center ml-auto cursor-pointer hover:opacity-75 transition-opacity"
                          style={{ width: `${labelRightCh}ch`, color: customLabelRightColor || '#64748b' }}
                          title="Click to color this text"
                        >
                          <ColorPickerPopover itemKey={labelRightKey} activePickerKey={activePickerKey} onSetColor={handleSetColor} />
                          {line.labelRight}
                        </div>
                      );
                    })()}
                  </div>
                );
              }

              return (
                <div key={lIdx} className={`flex flex-row items-center justify-start flex-nowrap whitespace-nowrap rounded-lg transition-all duration-300 ${
                  activeSectionIndex === lIdx ? 'ring-2 ring-indigo-500/40 bg-indigo-50/50 px-2 -mx-2' : ''
                }`} id={`chart-line-${lIdx}`}>
                  {/* Left Label */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePickerKey(activePickerKey === sectionKey ? null : sectionKey);
                    }}
                    className="relative shrink-0 font-extrabold text-lg sm:text-2xl md:text-3xl print:text-[1em] text-right pr-3 sm:pr-6 flex items-center justify-end font-sans select-none cursor-pointer hover:opacity-75 transition-opacity"
                    style={{ width: `${Math.max(7, labelCh)}ch`, minWidth: '6rem', color: customLabelColor || '#0f172a' }}
                    title="Click to color this section label"
                  >
                    <ColorPickerPopover itemKey={sectionKey} activePickerKey={activePickerKey} onSetColor={handleSetColor} position={popoverPos} />
                    {line.label ? `${line.label.charAt(0).toUpperCase()}${line.label.slice(1).toLowerCase()}:` : ''}
                  </div>

                  {/* Chords Container */}
                  <div className="flex items-center justify-start flex-nowrap shrink-0 text-xl sm:text-3xl md:text-[2rem] print:text-[1.2em]">
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

                      return (
                        <React.Fragment key={bIdx}>
                          <BarMarker marker={prefix} side="left" />
                          {block.bars.map((bar, barIdx) => {
                            const barKey = `bar-${lIdx}-${bIdx}-${barIdx}`;
                            const customBarColor = itemColors[barKey] || (chordColor !== '#0f172a' ? chordColor : undefined);

                            return (
                              <React.Fragment key={barIdx}>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActivePickerKey(activePickerKey === barKey ? null : barKey);
                                  }}
                                  className="relative inline-flex items-center justify-center min-w-[4rem] sm:min-w-[5.8rem] md:min-w-[6.8rem] px-1 sm:px-2.5 text-center font-extrabold transition-colors duration-150 text-lg sm:text-3xl md:text-[2rem] font-mono sm:font-sans cursor-pointer hover:bg-slate-100/80 rounded"
                                  style={{ color: customBarColor || '#0f172a' }}
                                  title="Click to color this chord"
                                >
                                  <ColorPickerPopover itemKey={barKey} activePickerKey={activePickerKey} onSetColor={handleSetColor} />
                                  {parseChord(bar || '_')}
                                </span>
                                {barIdx < block.bars.length - 1 && (
                                  <span className="inline-flex items-center justify-center text-slate-500 font-medium px-1 sm:px-2 text-lg sm:text-2xl md:text-3xl print:text-black">|</span>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}

                    {/* Final Suffix */}
                    {line.blocks.length > 0 && (() => {
                      const lastBlock = line.blocks[line.blocks.length - 1];
                      const suffix = lastBlock.endRepeat ? ':||' : '||';
                      return <BarMarker marker={suffix} side="right" />;
                    })()}
                  </div>
                  
                  {/* Right Label (Annotation text after || bar) */}
                  {line.labelRight && (() => {
                    const labelRightKey = `labelRight-${lIdx}-${line.labelRight}`;
                    const customLabelRightColor = itemColors[labelRightKey];
                    return (
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePickerKey(activePickerKey === labelRightKey ? null : labelRightKey);
                        }}
                        className="relative shrink-0 font-semibold print:text-black text-lg sm:text-2xl print:text-[1em] text-left pl-3 sm:pl-6 flex items-center cursor-pointer hover:opacity-75 transition-opacity"
                        style={{ width: `${labelRightCh}ch`, color: customLabelRightColor || '#64748b' }}
                        title="Click to color this text"
                      >
                        <ColorPickerPopover itemKey={labelRightKey} activePickerKey={activePickerKey} onSetColor={handleSetColor} />
                        {line.labelRight}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      id={id}
      onClick={onClick}
      className="flex text-left flex-col w-full min-h-full p-4 sm:p-8 md:p-10 print:p-0 bg-white print:bg-transparent rounded-2xl print:rounded-none relative mx-auto my-auto print:min-h-[28cm] print:w-full border-none shadow-none"
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
      {renderTextFlow(chart)}

      {/* Footer Info */}
      <div className={`print:hidden mt-auto pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] text-slate-400 font-bold tracking-widest uppercase transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center space-x-4">
          <span className="flex items-center text-indigo-600"><Cloud size={14} className="mr-2" /> Live Sync</span>
          {collaborators.length > 0 && (
            <span className="text-indigo-600">
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
