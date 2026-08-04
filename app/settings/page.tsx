'use client';

import React, { useState, useEffect } from 'react';
import { X, Type, Palette, Users, Info, Terminal, BookOpen, Droplet, CloudDownload, CheckCircle2, RefreshCw } from 'lucide-react';
import { Header } from '@/components/Header';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'font' | 'watermark' | 'offline' | 'stats' | 'about'>('font');
  const [currentFont, setCurrentFont] = useState('system');
  const [watermark, setWatermark] = useState('');
  const [userCount, setUserCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    setCurrentFont(localStorage.getItem('chord-grid-font') || 'system');
    setWatermark(localStorage.getItem('chord-grid-watermark') || '');
  }, []);

  // Fetch users when the stats tab is opened
  useEffect(() => {
    if (activeTab === 'stats' && userCount === null && !isLoadingCount) {
      const fetchUserCount = async () => {
        setIsLoadingCount(true);
        try {
          const { supabase } = await import('@/lib/supabase');
          // Call our custom RPC function
          const { data, error } = await supabase.rpc('get_user_count');
          if (error) throw error;
          setUserCount(data || 0);
        } catch (error) {
          console.error("Could not fetch user count. Did you run the SQL snippet?", error);
          setUserCount(null); // Keep it null to show the error/info message
        } finally {
          setIsLoadingCount(false);
        }
      };
      fetchUserCount();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleFontChange = (val: string) => {
    setCurrentFont(val);
    localStorage.setItem('chord-grid-font', val);
    window.dispatchEvent(new Event('chord-grid-font-change'));
  };

  const handleWatermarkChange = (val: string) => {
    setWatermark(val);
    localStorage.setItem('chord-grid-watermark', val);
    window.dispatchEvent(new Event('chord-grid-watermark-change'));
  };



  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Header />
      <main className="flex-1 overflow-y-auto w-full pt-12 pb-32 px-4 flex justify-center">
        <div className="bg-surface rounded-2xl w-full max-w-4xl shadow-popover border border-border flex flex-col max-h-[80vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-surface-raised">
          <h2 className="text-lg font-bold text-text-primary">Settings</h2>
          <button onClick={() => router.push('/')} className="p-2 text-text-secondary hover:text-white bg-surface border border-border rounded-full hover:bg-white/5 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-full sm:w-48 border-b sm:border-b-0 sm:border-r border-border bg-surface p-4 flex flex-row sm:flex-col gap-2 overflow-x-auto shrink-0">
            <button 
              onClick={() => setActiveTab('font')}
              className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'font' ? 'bg-accent-solid text-white' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
            >
              <Type size={16} className="mr-3" /> Font
            </button>
            
            <button 
              onClick={() => setActiveTab('watermark')}
              className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'watermark' ? 'bg-accent-solid text-white' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
            >
              <Droplet size={16} className="mr-3" /> Watermark
            </button>

            <button 
              onClick={() => setActiveTab('offline')}
              className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'offline' ? 'bg-accent-solid text-white' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
            >
              <CloudDownload size={16} className="mr-3" /> Offline Sync
            </button>

            <button 
              onClick={() => setActiveTab('stats')}
              className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'stats' ? 'bg-accent-solid text-white' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
            >
              <Users size={16} className="mr-3" /> User Stats
            </button>
            <button 
              onClick={() => setActiveTab('about')}
              className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'about' ? 'bg-accent-solid text-white' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
            >
              <Info size={16} className="mr-3" /> About
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-bg">
            
            {/* Font Tab */}
            {activeTab === 'font' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">Typography</h3>
                  <p className="text-sm text-text-primary mb-6">Choose the font style for your chord charts. Monospace fonts are recommended for perfect alignment.</p>
                  
                  <div className="space-y-3">
                    {[
                      { id: 'system', name: 'System Default' },
                      { id: "'Courier New', Courier, monospace", name: 'Courier New' },
                      { id: 'Consolas, monospace', name: 'Consolas' },
                      { id: "'Lucida Console', Monaco, monospace", name: 'Lucida Console' },
                      { id: "'Cascadia Code', 'Cascadia Mono', monospace", name: 'Cascadia Code' },
                      { id: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace', name: 'Apple / SF Mono' },
                    ].map(font => (
                      <button
                        key={font.id}
                        onClick={() => handleFontChange(font.id)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${currentFont === font.id ? 'border-accent-solid bg-accent-solid/10' : 'border-border bg-surface hover:border-text-secondary'}`}
                      >
                        <span className="font-bold text-text-primary" style={{ fontFamily: font.id }}>{font.name}</span>
                        {currentFont === font.id && <div className="w-2 h-2 rounded-full bg-accent-solid" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Watermark Tab */}
            {activeTab === 'watermark' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">Print Watermark</h3>
                  <p className="text-sm text-text-primary mb-6">Set a custom watermark text (e.g. "Draft", "Confidential", or your band name) that will appear diagonally across your printed PDF charts.</p>
                  
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="e.g. DRAFT"
                      value={watermark}
                      onChange={(e) => handleWatermarkChange(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-raised border border-border rounded-xl text-text-primary focus:outline-none focus:border-accent-solid transition-colors"
                    />
                    <p className="text-xs text-text-secondary">Leave blank for no watermark.</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Offline Tab */}
            {activeTab === 'offline' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">Offline Access</h3>
                  <p className="text-sm text-text-primary mb-6">
                    Pre-download all your cloud chord charts, lyrics, and folders into your device's local database so you can access them anywhere without an internet connection.
                  </p>
                  
                  <div className="p-6 bg-surface border border-border rounded-2xl space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-accent-solid/10 text-accent-start rounded-xl">
                        <CloudDownload size={24} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-text-primary">Sync All Songs Offline</h4>
                        <p className="text-xs text-text-secondary">Downloads all existing charts & lyrics into local IndexedDB.</p>
                      </div>
                    </div>

                    {syncResult && (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-xs font-bold flex items-center">
                        <CheckCircle2 size={16} className="mr-2 shrink-0" />
                        {syncResult}
                      </div>
                    )}

                    <button
                      disabled={syncingOffline}
                      onClick={async () => {
                        setSyncingOffline(true);
                        setSyncResult(null);
                        try {
                          const { syncAllOffline } = await import('@/lib/storage');
                          const res = await syncAllOffline();
                          setSyncResult(`Successfully downloaded ${res.chartsCount} charts, ${res.lyricsCount} lyrics, and ${res.foldersCount} folders to local storage!`);
                        } catch (err) {
                          setSyncResult('Failed to sync songs. Please check your internet connection.');
                        } finally {
                          setSyncingOffline(false);
                        }
                      }}
                      className="w-full py-3 px-4 bg-accent-gradient text-white rounded-xl font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center disabled:opacity-50"
                    >
                      {syncingOffline ? (
                        <>
                          <RefreshCw size={18} className="mr-2 animate-spin" />
                          Downloading to Device...
                        </>
                      ) : (
                        <>
                          <CloudDownload size={18} className="mr-2" />
                          Download All Songs Now
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}


            {/* Stats Tab */}
            {activeTab === 'stats' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">Platform Stats</h3>
                  
                  <div className="bg-surface border border-border p-6 rounded-2xl flex flex-col items-center justify-center py-12 shadow-inner mb-6">
                    {isLoadingCount ? (
                      <div className="w-8 h-8 rounded-full border-2 border-accent-solid border-t-transparent animate-spin mb-4" />
                    ) : userCount !== null ? (
                      <>
                        <span className="text-7xl font-bold font-mono text-transparent bg-clip-text bg-accent-gradient mb-2">{userCount}</span>
                        <span className="text-sm font-bold text-text-secondary uppercase tracking-widest">Registered Users</span>
                      </>
                    ) : (
                      <div className="text-center max-w-sm">
                        <Users size={32} className="mx-auto text-text-secondary mb-4" />
                        <h4 className="font-bold text-text-primary mb-2">Setup Required</h4>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          To view the total number of users, you need to run the SQL snippet in your Supabase dashboard to create the `get_user_count` function.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* About Tab */}
            {activeTab === 'about' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 pb-12">
                
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4 flex items-center">
                    <BookOpen size={16} className="mr-2" /> User Manual
                  </h3>
                  <div className="prose prose-invert max-w-none text-sm text-text-primary">
                    <p className="mb-4 text-text-secondary">Welcome to ChordCraft! Here is a quick guide on how to use the editor.</p>
                    
                    <h4 className="font-bold text-white text-base mt-6 mb-2">Creating Charts</h4>
                    <ul className="list-disc pl-5 space-y-2 mb-6 text-text-secondary">
                      <li>Click the <strong>New Chart</strong> button in the Create menu to start a blank chart.</li>
                      <li>Use the <strong>+ Add Line</strong> or <strong>+ Add Section</strong> buttons at the bottom of the editor to add more lines.</li>
                      <li>Click on any bar (the grid cells) to start typing chords.</li>
                    </ul>

                    <h4 className="font-bold text-white text-base mt-6 mb-2">Writing Chords</h4>
                    <ul className="list-disc pl-5 space-y-2 mb-6 text-text-secondary">
                      <li>Type chords like <code>C</code>, <code>Am7</code>, <code>D/F#</code>.</li>
                      <li>To fit multiple chords in one bar, separate them with commas (e.g. <code>C, G</code>).</li>
                      <li>To indicate a rest, you can use a dash <code>-</code>.</li>
                      <li>You can add lyrics or text above the bars using the text toggle at the top of the editor.</li>
                    </ul>

                    <h4 className="font-bold text-white text-base mt-6 mb-2">Transposition</h4>
                    <ul className="list-disc pl-5 space-y-2 mb-6 text-text-secondary">
                      <li>Use the <strong>Transpose</strong> buttons (- and +) in the editor header to instantly change the key of the entire chart.</li>
                      <li>Toggle the <strong>♭/♯</strong> button to switch between flat and sharp preferences.</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4 flex items-center">
                    <Terminal size={16} className="mr-2" /> Keyboard Shortcuts
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-surface border border-border p-3 rounded-xl flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Navigate Grid</span>
                      <div className="flex space-x-1">
                        <kbd className="px-2 py-1 bg-surface-raised border border-border rounded text-xs font-mono text-text-primary">Tab</kbd>
                        <kbd className="px-2 py-1 bg-surface-raised border border-border rounded text-xs font-mono text-text-primary">Shift+Tab</kbd>
                      </div>
                    </div>
                    <div className="bg-surface border border-border p-3 rounded-xl flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Navigate Directions</span>
                      <div className="flex space-x-1">
                        <kbd className="px-2 py-1 bg-surface-raised border border-border rounded text-xs font-mono text-text-primary">Arrows</kbd>
                      </div>
                    </div>
                    <div className="bg-surface border border-border p-3 rounded-xl flex justify-between items-center">
                      <span className="text-sm text-text-secondary">Clear Bar</span>
                      <div className="flex space-x-1">
                        <kbd className="px-2 py-1 bg-surface-raised border border-border rounded text-xs font-mono text-text-primary">Backspace</kbd>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
            
          </div>
        </div>

        </div>
      </main>
    </div>
  );
}
