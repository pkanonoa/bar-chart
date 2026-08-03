'use client';

import { useAuth } from '@/components/AuthProvider';
import { useChartSync } from '@/hooks/useChartSync';
import { useParams, useRouter } from 'next/navigation';
import { ChordInput } from '@/components/ChordInput';
import { transposeChart, resetChartTranspose } from '@/lib/transpose';
import { createDefaultLine, createDefaultBlock, Line, Block } from '@/lib/chart-types';
import { parseChordToText } from '@/lib/chord-parser';
import { moveEntry } from '@/lib/storage';
import { FolderPickerModal } from '@/components/FolderPickerModal';
import { X, Plus, LogOut, Download, Copy, RefreshCw, Cloud, CloudOff, Edit2, Folder as FolderIcon, CornerLeftUp } from 'lucide-react';
import { ChartData } from '@/lib/chart-types';
import React, { useState } from 'react';

export default function ChartEditor() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const chartId = params.id as string;
  
  const { chart, loading: chartLoading, saveStatus, collaborators, updateChart, forceSave } = useChartSync(chartId);
  const [copied, setCopied] = useState(false);
  const [customText, setCustomText] = useState<string | null>(null);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const isTypingText = React.useRef(false);

  const generateText = React.useCallback((chartData: typeof chart) => {
    if (!chartData) return '';
    const title = chartData.title || 'Untitled Chart';
    const timeSig = chartData.time_sig || '4/4';
    const tempo = `t=${chartData.tempo || 120}`;
    const headerStr = `${title}      ${timeSig}      ${tempo}`;

    const maxLabelLen = Math.max(...chartData.lines.map(l => l.label ? l.label.length : 0));
    let bodyLines: string[] = [];

    chartData.lines.forEach(line => {
      let lineTxt = '';
      if (maxLabelLen > 0) {
        if (line.label) {
          lineTxt += `${line.label.padStart(maxLabelLen)}: `;
        } else {
          lineTxt += ' '.repeat(maxLabelLen + 2);
        }
      }
      
      if (line.blocks.length > 0) {
        line.blocks.forEach((block, bIdx) => {
          const isFirst = bIdx === 0;
          
          if (isFirst) {
            lineTxt += block.startRepeat ? '||: ' : '|| ';
          } else {
            const prevBlock = line.blocks[bIdx - 1];
            if (prevBlock.endRepeat && block.startRepeat) {
              lineTxt += ' :||: ';
            } else if (prevBlock.endRepeat) {
              lineTxt += ' :|| ';
            } else if (block.startRepeat) {
              lineTxt += ' ||: ';
            } else {
              lineTxt += ' || ';
            }
          }
          
          lineTxt += block.bars.map(b => (b ? parseChordToText(b) : '_')).join(' | ');
        });
        
        const lastBlock = line.blocks[line.blocks.length - 1];
        if (lastBlock && lastBlock.endRepeat) {
          lineTxt += ' :||';
        } else {
          lineTxt += ' ||';
        }
      }
      if (line.labelRight) {
        lineTxt += line.blocks.length > 0 ? ` ${line.labelRight}` : line.labelRight;
      }
      lineTxt += '\n\n';
      bodyLines.push(lineTxt);
    });

    const maxBodyLen = Math.max(...bodyLines.map(l => l.replace(/\n/g, '').length), headerStr.length);
    const padding = Math.max(0, Math.floor((maxBodyLen - headerStr.length) / 2));
    
    let txt = ' '.repeat(padding) + headerStr + '\n\n';
    txt += bodyLines.join('');

    return txt.trimEnd();
  }, []);

  const normalizeChordText = (text: string) => {
    let normalized = text
      .replace(/♭/g, 'b')
      .replace(/♯/g, '#')
      .replace(/△/g, 'maj7')
      .replace(/°/g, 'dim')
      .replace(/⁺/g, 'aug');
    
    const INVERSE_SUPER_MAP: Record<string, string> = {
      '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
      '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
      '⁺': '+', '⁻': '-',
      'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e',
      'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j',
      'ᵏ': 'k', 'ˡ': 'l', 'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o',
      'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u',
      'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z',
      'ᴬ': 'A', 'ᴮ': 'B', 'ᴰ': 'D', 'ᴱ': 'E', 'ᴳ': 'G',
      'ᴴ': 'H', 'ᴵ': 'I', 'ᴶ': 'J', 'ᴷ': 'K', 'ᴸ': 'L',
      'ᴹ': 'M', 'ᴺ': 'N', 'ᴼ': 'O', 'ᴾ': 'P', 'ᴿ': 'R',
      'ᵀ': 'T', 'ᵁ': 'U', 'ⱽ': 'V', 'ᵂ': 'W',
    };
    
    let result = '';
    for (const char of normalized) {
      result += INVERSE_SUPER_MAP[char] || char;
    }
    return result;
  };

  const parseTextToLines = React.useCallback((text: string) => {
    const lines: Line[] = [];
    const textLines = text.split('\n');
    
    for (const tLine of textLines) {
      if (!tLine.trim()) continue; 
      
      // Skip the auto-generated header line so it doesn't become a text annotation
      if (tLine.includes('t=') && !tLine.includes('|') && lines.length === 0) {
        continue;
      }
      
      if (!tLine.includes('|')) {
        lines.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          label: '',
          labelRight: tLine.trim(),
          blocks: []
        });
        continue;
      }
      
      let label = '';
      let labelRight = '';
      let content = tLine.trim();
      
      const firstBarMatch = content.match(/^(.*?):\s*(\|\|:|\|\|)(.*)$/);
      if (firstBarMatch) {
        label = firstBarMatch[1].trim();
        content = firstBarMatch[2] + firstBarMatch[3];
      } else {
        const altMatch = content.match(/^(.*?)\s+(\|\|:|\|\|)(.*)$/);
        if (altMatch && !altMatch[1].includes('|')) {
           label = altMatch[1].trim();
           if (label.endsWith(':')) label = label.slice(0, -1);
           content = altMatch[2] + altMatch[3];
        }
      }
      
      // Extract labelRight from the end
      const lastBarMatch = content.match(/^(.*?)(\|\||:\|\|)\s+(.+)$/);
      if (lastBarMatch && !lastBarMatch[3].includes('|')) {
        content = lastBarMatch[1] + lastBarMatch[2];
        labelRight = lastBarMatch[3].trim();
      }
      
      const tokens = content.split(/(\|\|:|:\|\|:|:\|\||\|\|)/).map(s => s.trim()).filter(s => s !== '');
      let blocks: Block[] = [];
      let currentBlock: Block | null = null;
      
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        if (token === '||' || token === '||:') {
          if (currentBlock) blocks.push(currentBlock);
          currentBlock = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            startRepeat: token === '||:',
            endRepeat: false,
            bars: []
          };
        } else if (token === ':||' || token === ':||:') {
          if (currentBlock) {
            currentBlock.endRepeat = true;
            blocks.push(currentBlock);
            currentBlock = null;
          }
          if (token === ':||:') {
            currentBlock = {
              id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
              startRepeat: true,
              endRepeat: false,
              bars: []
            };
          }
        } else {
          if (!currentBlock) {
            currentBlock = {
              id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
              startRepeat: false,
              endRepeat: false,
              bars: []
            };
          }
          const bars = token.split('|').map(b => b.trim());
          currentBlock.bars.push(...bars.map(b => b === '_' || b === '' ? '' : normalizeChordText(b)));
        }
      }
      if (currentBlock) blocks.push(currentBlock);
      
      blocks = blocks.filter(b => b.bars.length > 0 || b.startRepeat || b.endRepeat);
      
      if (blocks.length > 0) {
        lines.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          label,
          labelRight,
          blocks
        });
      }
    }
    
    if (lines.length === 0) {
      lines.push(createDefaultLine());
    }
    return lines;
  }, []);

  React.useEffect(() => {
    if (chart && !isTypingText.current) {
      setCustomText(generateText(chart));
    }
  }, [chart, generateText]);

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

  const handleBlockEdit = (updates: Partial<typeof chart>) => {
    // If they edit the grid, we also clear custom_text so it doesn't override the viewer
    updateChart({ ...updates, custom_text: null });
  };

  const updateTitle = (title: string) => handleBlockEdit({ title });
  const updateTempo = (tempo: number) => handleBlockEdit({ tempo });
  const updateTimeSig = (time_sig: string) => handleBlockEdit({ time_sig });

  const addLine = () => handleBlockEdit({ lines: [...chart.lines, createDefaultLine()] });
  
  const insertLineAfter = (lineId: string) => {
    const index = chart.lines.findIndex(l => l.id === lineId);
    if (index === -1) return;
    const newLines = [...chart.lines];
    newLines.splice(index + 1, 0, createDefaultLine());
    handleBlockEdit({ lines: newLines });
  };
  
  const removeLine = (lineId: string) => {
    if (chart.lines.length <= 1) return;
    handleBlockEdit({ lines: chart.lines.filter(l => l.id !== lineId) });
  };

  const updateLineLabel = (lineId: string, label: string) => {
    const newLines = chart.lines.map(l => l.id === lineId ? { ...l, label } : l);
    handleBlockEdit({ lines: newLines });
  };

  const updateLineLabelRight = (lineId: string, labelRight: string) => {
    const newLines = chart.lines.map(l => l.id === lineId ? { ...l, labelRight } : l);
    handleBlockEdit({ lines: newLines });
  };

  const addBlock = (lineId: string, atStart: boolean) => {
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const newBlock = createDefaultBlock();
      const blocks = atStart ? [newBlock, ...l.blocks] : [...l.blocks, newBlock];
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  };

  const removeBlock = (lineId: string, blockId: string) => {
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      if (l.blocks.length <= 1) return l;
      return { ...l, blocks: l.blocks.filter(b => b.id !== blockId) };
    });
    handleBlockEdit({ lines: newLines });
  };

  const addBarToBlock = (lineId: string, blockId: string) => {
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => {
        if (b.id !== blockId) return b;
        return { ...b, bars: [...b.bars, ''] };
      });
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  };

  const toggleStartRepeat = (lineId: string, blockId: string) => {
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => b.id === blockId ? { ...b, startRepeat: !b.startRepeat } : b);
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  };

  const toggleEndRepeat = (lineId: string, blockId: string) => {
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => b.id === blockId ? { ...b, endRepeat: !b.endRepeat } : b);
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  };

  const formatChordCase = (val: string) => {
    if (!val) return val;
    return val.split('/').map(part => {
      if (!part) return part;
      // Capitalize first letter, lowercase the rest
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join('/');
  };

  const updateBar = (lineId: string, blockId: string, barIndex: number, val: string) => {
    const formattedVal = formatChordCase(val);
    const newLines = chart.lines.map(l => {
      if (l.id !== lineId) return l;
      const blocks = l.blocks.map(b => {
        if (b.id !== blockId) return b;
        const newBars = [...b.bars];
        newBars[barIndex] = formattedVal;
        return { ...b, bars: newBars };
      });
      return { ...l, blocks };
    });
    handleBlockEdit({ lines: newLines });
  };

  const handleTranspose = (delta: number) => handleBlockEdit(transposeChart(chart, delta, chart.prefer_flats));
  const handleResetTranspose = () => handleBlockEdit(resetChartTranspose(chart));
  const toggleSpelling = () => handleBlockEdit(transposeChart(chart, 0, !chart.prefer_flats));

  const clearAll = () => {
    if (confirm('Are you sure you want to clear all chords?')) {
       const clearedLines = chart.lines.map(line => ({
         ...line,
         blocks: line.blocks.map(block => ({
           ...block,
           bars: block.bars.map(() => '')
         }))
       }));
       handleBlockEdit({ lines: clearedLines });
    }
  };

  const copyAsText = () => {
    navigator.clipboard.writeText(customText || generateText(chart));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMoveChart = async (newFolderId: string | null) => {
    await moveEntry(chart.id, 'chart', newFolderId);
    updateChart({ folder_id: newFolderId });
  };


  const totalLines = chart.lines.length;
  const totalBars = chart.lines.reduce((sum, line) => sum + line.blocks.reduce((bSum, block) => bSum + block.bars.length, 0), 0);

  return (
    <div className="min-h-screen bg-bg flex flex-col text-text-primary relative pb-32">
      
      {/* Editor Main Content */}
      <main className="flex-1 overflow-x-hidden p-4 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-12">
          
          {/* Header & Metadata */}
          <div className="flex flex-col items-center justify-center relative mb-4">
            
            {/* Top Bar for buttons */}
            <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <button 
                onClick={async () => {
                  await forceSave();
                  router.push(`/chart/${chart.id}`);
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
                <div className="flex items-center text-[10px] font-bold tracking-widest uppercase bg-surface-raised border border-border shadow-inner rounded-xl px-4 py-2 h-full">
                  {saveStatus === 'saving' && <span className="text-text-secondary flex items-center"><RefreshCw size={14} className="mr-2 animate-spin" /> Saving</span>}
                  {saveStatus === 'saved' && <span className="text-accent-solid flex items-center"><Cloud size={14} className="mr-2" /> Saved</span>}
                  {saveStatus === 'offline' && <span className="text-red-500 flex items-center"><CloudOff size={14} className="mr-2" /> Offline</span>}
                </div>
              </div>
            </div>
            
            {/* Center aligned inputs */}
            <div className="flex flex-wrap justify-center items-end gap-6 sm:gap-12 text-center bg-surface border border-border shadow-card rounded-3xl p-8 w-full">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold tracking-widest text-text-secondary uppercase mb-2">Title</label>
                <input 
                  value={chart.title}
                  onChange={e => updateTitle(e.target.value)}
                  className="bg-surface-raised border border-border shadow-inner rounded-xl px-4 py-3 text-lg sm:text-2xl font-bold text-text-primary focus:outline-none focus:border-accent-solid text-center w-full transition-all"
                  placeholder="Untitled progression"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold tracking-widest text-text-secondary uppercase mb-2">Tempo</label>
                <div className="flex items-center text-lg sm:text-xl font-bold text-text-primary justify-center bg-surface-raised border border-border shadow-inner rounded-xl px-4 py-3 focus-within:border-accent-solid transition-all">
                  <span className="mr-2 text-text-secondary">BPM</span>
                  <input 
                    type="number" 
                    value={chart.tempo || ''}
                    onChange={e => updateTempo(parseInt(e.target.value) || 120)}
                    className="bg-transparent w-16 focus:outline-none text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-widest text-text-secondary uppercase mb-2">Time</label>
                <input 
                  value={chart.time_sig || ''}
                  onChange={e => updateTimeSig(e.target.value)}
                  className="bg-surface-raised border border-border shadow-inner rounded-xl px-4 py-3 text-lg sm:text-xl font-bold text-text-primary focus:outline-none focus:border-accent-solid w-24 text-center transition-all"
                  placeholder="4/4"
                />
              </div>
            </div>
            
            <div className="absolute right-0 bottom-0 text-[10px] font-bold tracking-widest text-text-secondary hidden sm:block uppercase">
              {totalLines} lines • {totalBars} bars total
            </div>
          </div>

          {/* Lines & Grid */}
          <div className="space-y-6">
            {chart.lines.map((line) => (
              <div key={line.id} className="flex items-stretch bg-surface border border-border shadow-card rounded-2xl relative group">
                
                {/* Left controls: Part name & Delete */}
                <div className="w-24 sm:w-40 flex flex-col justify-center p-3 sm:p-5 shrink-0 bg-white/5 rounded-l-2xl border-r border-border">
                  <div className="flex items-center justify-between">
                    <input 
                      value={line.label}
                      onChange={e => updateLineLabel(line.id, e.target.value)}
                      placeholder="Part name"
                      className="bg-surface-raised border border-border shadow-inner rounded-lg px-2 py-1 text-xs sm:text-sm font-bold text-text-primary focus:outline-none focus:border-accent-solid w-full mr-2 transition-all"
                    />
                    <button 
                      onClick={() => removeLine(line.id)}
                      disabled={chart.lines.length <= 1}
                      className="text-text-secondary hover:text-red-500 disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-opacity bg-surface border border-border shadow-sm hover:bg-surface-raised rounded-md p-1"
                      title="Remove line"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Pre-block Add */}
                <button 
                  onClick={() => addBlock(line.id, true)} 
                  className="px-2 sm:px-4 text-text-secondary hover:text-accent-start transition-all flex items-center justify-center shrink-0 border-r border-border hover:bg-white/5"
                  title="Add block"
                >
                  <Plus size={16} />
                </button>

                {/* Scrollable Blocks Grid */}
                <div className="flex-1 overflow-x-auto py-6 px-4 flex items-center">
                  <div className="flex flex-nowrap gap-x-2">
                    {line.blocks.map((block, bIdx) => (
                      <React.Fragment key={block.id}>
                        <div className="flex items-center group/block shrink-0 bg-surface-raised border border-border shadow-inner rounded-xl p-2 sm:p-3">
                          <div 
                            onClick={() => toggleStartRepeat(line.id, block.id)}
                            className="flex items-center cursor-pointer hover:text-accent-start transition-colors mx-1 sm:mx-2 group/repeat"
                            title="Toggle start repeat"
                          >
                            <span className="text-2xl font-light text-text-secondary group-hover/repeat:text-accent-start">‖</span>
                            {block.startRepeat && (
                              <span className="text-3xl font-bold text-accent-solid ml-1 leading-none mt-[-4px]">:</span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2 sm:space-x-3 relative">
                            {block.bars.map((bar, barIdx) => (
                              <React.Fragment key={`${block.id}-${barIdx}`}>
                                <div className="w-14 h-10 sm:w-28 sm:h-14 bg-surface border border-border shadow-sm rounded-lg transition-all focus-within:border-accent-solid focus-within:shadow-[0_0_0_1px_var(--accent-solid)] shrink-0 overflow-hidden">
                                  <ChordInput 
                                    value={bar} 
                                    onChange={(val) => updateBar(line.id, block.id, barIdx, val)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const inputs = Array.from(document.querySelectorAll('.chord-input-field')) as HTMLInputElement[];
                                        const index = inputs.indexOf(e.currentTarget);
                                        if (index > -1 && index < inputs.length - 1) {
                                          inputs[index + 1].focus();
                                          inputs[index + 1].select();
                                        }
                                      }
                                    }}
                                    className="w-full h-full text-text-primary font-bold text-center bg-transparent focus:outline-none"
                                  />
                                </div>
                                {barIdx < block.bars.length - 1 && (
                                  <div className="text-3xl font-light text-border select-none">|</div>
                                )}
                              </React.Fragment>
                            ))}
                            
                            {/* Remove block cross */}
                            <div className="absolute -top-6 right-0 opacity-0 group-hover/block:opacity-100 transition-opacity">
                              <button 
                                onClick={() => removeBlock(line.id, block.id)}
                                disabled={line.blocks.length <= 1}
                                className="p-1.5 bg-surface border border-border shadow-sm hover:bg-surface-raised rounded-full text-text-secondary hover:text-red-500 disabled:opacity-50 disabled:shadow-none transition-all"
                                title="Remove block"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                          
                          <div 
                            onClick={() => toggleEndRepeat(line.id, block.id)}
                            className="flex items-center cursor-pointer hover:text-accent-start transition-colors mx-2 group/repeat"
                            title="Toggle end repeat"
                          >
                            {block.endRepeat && (
                              <span className="text-3xl font-bold text-accent-solid mr-1 leading-none mt-[-4px]">:</span>
                            )}
                            <span className="text-2xl font-light text-text-secondary group-hover/repeat:text-accent-start">‖</span>
                          </div>
                        </div>
                        
                        {/* Add Bar to block (between blocks basically) */}
                        <div className="flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity px-2 shrink-0">
                          <button 
                            onClick={() => addBarToBlock(line.id, block.id)}
                            className="p-2 bg-surface border border-border shadow-sm rounded-xl text-text-secondary hover:text-accent-start hover:bg-surface-raised transition-all"
                            title="Add bar"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Post-block Add */}
                <button 
                  onClick={() => addBlock(line.id, false)} 
                  className="px-2 sm:px-4 text-text-secondary hover:text-accent-start transition-all flex items-center justify-center shrink-0 border-l border-border hover:bg-white/5"
                  title="Add block"
                >
                  <Plus size={16} />
                </button>
                
                {/* Right controls: Part name (end) */}
                <div className="w-24 sm:w-40 flex flex-col justify-center p-3 sm:p-5 shrink-0 bg-white/5 rounded-r-2xl border-l border-border">
                  <div className="flex items-center">
                    <input 
                      value={line.labelRight || ''}
                      onChange={e => updateLineLabelRight(line.id, e.target.value)}
                      placeholder="Text"
                      className="bg-surface-raised border border-border shadow-inner rounded-lg px-2 py-1 text-xs sm:text-sm font-bold text-text-primary focus:outline-none focus:border-accent-solid w-full transition-all"
                    />
                  </div>
                </div>

                {/* Insert Line Below */}
                <div className="absolute -bottom-4 right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => insertLineAfter(line.id)}
                    className="flex items-center justify-center p-1.5 sm:p-2 bg-surface border border-border shadow-md rounded-full text-text-secondary hover:text-accent-start hover:bg-surface-raised transition-all backdrop-blur-sm"
                    title="Insert line below"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 justify-center">
            <button 
              onClick={addLine}
              className="flex items-center px-6 py-3 bg-surface border border-border shadow-md text-text-secondary hover:text-accent-start hover:bg-surface-raised rounded-xl transition-all text-sm font-bold tracking-widest uppercase"
            >
              <Plus size={16} className="mr-2" /> Add Line
            </button>
            
            <button 
              onClick={copyAsText}
              className="px-6 py-3 bg-accent-gradient shadow-md text-white hover:brightness-110 rounded-xl transition-all text-sm font-bold tracking-widest uppercase"
            >
              {copied ? 'Copied!' : 'Copy As Text'}
            </button>
            
            <button 
              onClick={clearAll}
              className="px-6 py-3 bg-surface border border-border shadow-md text-red-400 hover:text-red-300 hover:bg-surface-raised rounded-xl transition-all text-sm font-bold tracking-widest uppercase"
            >
              Clear All
            </button>
          </div>

          {/* Transpose Controls */}
          <div className="border-t border-border pt-8 mt-8 flex flex-wrap items-center gap-6 sm:gap-8 justify-center">
            <span className="text-sm font-bold tracking-widest text-text-secondary uppercase">Transpose</span>
            
            <div className="flex items-center space-x-2 bg-surface-raised border border-border shadow-inner rounded-2xl px-2 py-2">
              <button onClick={() => handleTranspose(-1)} className="w-10 h-10 flex items-center justify-center bg-surface border border-border shadow-sm rounded-xl text-text-secondary hover:text-white hover:bg-white/5 transition-all text-lg font-bold">−</button>
              <span className="font-bold text-accent-start min-w-[120px] text-center">
                {chart.semitone_offset === 0 ? 'Concert pitch' : `${chart.semitone_offset > 0 ? '+' : ''}${chart.semitone_offset} semitones`}
              </span>
              <button onClick={() => handleTranspose(1)} className="w-10 h-10 flex items-center justify-center bg-surface border border-border shadow-sm rounded-xl text-text-secondary hover:text-white hover:bg-white/5 transition-all text-lg font-bold">+</button>
            </div>
            
            {chart.semitone_offset !== 0 && (
              <button onClick={handleResetTranspose} className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-accent-start bg-surface border border-border shadow-md rounded-xl hover:bg-surface-raised transition-all">
                Reset
              </button>
            )}

            <button 
              onClick={toggleSpelling} 
              className={`px-5 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all border border-border shadow-md ${chart.prefer_flats ? 'bg-surface-raised text-accent-solid shadow-inner border-accent-solid' : 'bg-surface text-text-secondary hover:text-white hover:bg-surface-raised'}`}
            >
              Spelling: {chart.prefer_flats ? '♭' : '♯'}
            </button>
            
            {/* Network Sync Status pushed to right */}
            <div className="ml-0 sm:ml-auto flex items-center space-x-6 mt-4 sm:mt-0">
              {collaborators.length > 0 && (
                <div className="flex -space-x-2">
                  {collaborators.map((email, idx) => (
                    <div key={idx} className="h-8 w-8 rounded-full bg-surface-raised border border-accent-solid shadow-inner flex items-center justify-center text-xs font-bold text-accent-start" title={`${email} is editing`}>
                      {email.charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center text-xs font-bold uppercase tracking-widest bg-surface-raised border border-border shadow-inner rounded-xl px-4 py-2">
                {saveStatus === 'saving' && <><RefreshCw size={14} className="mr-2 text-text-secondary animate-spin" /> <span className="text-text-secondary">Saving...</span></>}
                {saveStatus === 'saved' && <><Cloud size={14} className="mr-2 text-accent-solid" /> <span className="text-accent-solid">Saved</span></>}
                {saveStatus === 'offline' && <><CloudOff size={14} className="mr-2 text-red-500" /> <span className="text-red-500">Offline</span></>}
              </div>
            </div>
          </div>

          {/* Text Editor */}
          <div className="border-t border-border pt-12 mb-12">
            <label className="block text-xs font-bold tracking-widest text-text-secondary uppercase mb-4 text-center">Text Editor & Preview</label>
            <textarea 
              className="w-full h-64 bg-surface-raised border border-border shadow-inner rounded-3xl p-8 font-mono text-[13px] sm:text-[15px] text-text-primary font-medium whitespace-pre-wrap resize-y focus:outline-none focus:border-accent-solid transition-all leading-relaxed"
              value={customText || ''}
              onFocus={() => isTypingText.current = true}
              onBlur={() => {
                isTypingText.current = false;
                if (chart) setCustomText(generateText(chart));
              }}
              onChange={(e) => {
                const newText = e.target.value;
                setCustomText(newText);
                try {
                  const newLines = parseTextToLines(newText);
                  updateChart({ lines: newLines, custom_text: null });
                } catch (err) {}
              }}
              spellCheck={false}
            />
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
