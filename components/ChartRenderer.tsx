import React from 'react';
import { Cloud } from 'lucide-react';
import { parseChord } from '@/lib/chord-parser';
import { ChartData } from '@/lib/chart-types';

interface ChartRendererProps {
  chart: ChartData;
  showUI?: boolean;
  collaborators?: any[];
  watermark?: string;
  selectedFont?: string;
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
  onClick,
  id = 'chart-card',
  activeSectionIndex,
}: ChartRendererProps) {
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
          <div className="flex flex-col gap-5 sm:gap-8 print:gap-10 w-fit mx-auto print:mx-0 max-w-full overflow-x-auto scrollbar-none px-2 py-2">
            {chartData.lines.map((line, lIdx) => {
              if (line.blocks.length === 0) {
                return (
                  <div key={lIdx} className={`flex flex-row items-center justify-start w-full flex-nowrap whitespace-nowrap rounded-lg transition-all duration-300 ${
                    activeSectionIndex === lIdx ? 'ring-2 ring-indigo-500/40 bg-indigo-50/50 px-2 -mx-2' : ''
                  }`} id={`chart-line-${lIdx}`}>
                    {/* Left Label */}
                    {line.label ? (
                      <div 
                        className="shrink-0 text-slate-800 font-extrabold text-lg sm:text-2xl md:text-3xl print:text-[1em] text-right pr-3 sm:pr-6 flex items-center justify-end font-sans select-none"
                        style={{ width: `${Math.max(7, labelCh)}ch`, minWidth: '6rem' }}
                      >
                        {line.label.charAt(0).toUpperCase()}{line.label.slice(1).toLowerCase()}:
                      </div>
                    ) : (
                      <div className="shrink-0" style={{ width: `${Math.max(7, labelCh)}ch`, minWidth: '6rem' }}></div>
                    )}

                    {/* Right Label (Annotation) */}
                    {line.labelRight && (
                      <div 
                        className="shrink-0 text-slate-500 font-semibold print:text-black text-lg sm:text-2xl print:text-[1em] text-left pl-3 sm:pl-6 flex items-center ml-auto"
                        style={{ width: `${labelRightCh}ch` }}
                      >
                        {line.labelRight}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={lIdx} className={`flex flex-row items-center justify-start flex-nowrap whitespace-nowrap rounded-lg transition-all duration-300 ${
                  activeSectionIndex === lIdx ? 'ring-2 ring-indigo-500/40 bg-indigo-50/50 px-2 -mx-2' : ''
                }`} id={`chart-line-${lIdx}`}>
                  {/* Left Label */}
                  <div 
                    className="shrink-0 text-slate-800 font-extrabold text-lg sm:text-2xl md:text-3xl print:text-[1em] text-right pr-3 sm:pr-6 flex items-center justify-end font-sans select-none"
                    style={{ width: `${Math.max(7, labelCh)}ch`, minWidth: '6rem' }}
                  >
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
                          <span className={`inline-block pr-1.5 sm:pr-3 print:pr-1 text-left tracking-tighter print:!tracking-normal print:!font-normal print:!text-[1em] ${prefix.includes('||') ? 'text-slate-800 font-extrabold text-[1.2em] sm:text-[1.35em] print:text-black' : 'text-slate-800 font-bold print:text-black'}`}>{prefix}</span>
                          {block.bars.map((bar, barIdx) => (
                            <React.Fragment key={barIdx}>
                              <span className="inline-flex items-center justify-center min-w-[4rem] sm:min-w-[5.8rem] md:min-w-[6.8rem] px-1 sm:px-2.5 text-center font-extrabold text-slate-900 hover:text-indigo-600 transition-colors duration-150 text-lg sm:text-3xl md:text-[2rem] font-mono sm:font-sans">
                                {parseChord(bar || '_')}
                              </span>
                              {barIdx < block.bars.length - 1 && (
                                <span className="inline-flex items-center justify-center text-slate-400 font-medium px-1 sm:px-2 text-lg sm:text-2xl md:text-3xl print:text-black">|</span>
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
                        <span className={`inline-block pl-1.5 sm:pl-3 print:pl-1 text-left tracking-tighter print:!tracking-normal print:!font-normal print:!text-[1em] ${suffix.includes('||') ? 'text-slate-800 font-extrabold text-[1.2em] sm:text-[1.35em] print:text-black' : 'text-slate-800 font-bold print:text-black'}`}>
                          {suffix}
                        </span>
                      );
                    })()}
                  </div>
                  
                  {/* Right Label */}
                  {maxLabelRightLen > 0 && (
                    <div 
                      className="shrink-0 text-slate-500 font-semibold print:text-black text-lg sm:text-2xl print:text-[1em] text-left pl-3 sm:pl-6 flex items-center"
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
