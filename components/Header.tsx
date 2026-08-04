'use client';

import { useAuth } from './AuthProvider';
import { Menu, Home, Type, ListMusic, Music2, Printer } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from './Sidebar';
import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  {
    id: 'chords',
    label: 'Chords',
    icon: Home,
    href: '/',
    match: (p: string) => p === '/' || p.startsWith('/folder/') || (p.startsWith('/chart/') && !p.includes('/setlists')),
  },
  {
    id: 'lyrics',
    label: 'Lyrics',
    icon: Type,
    href: '/lyrics',
    match: (p: string) => p.startsWith('/lyrics'),
  },
  {
    id: 'setlists',
    label: 'Setlists',
    icon: ListMusic,
    href: '/setlists',
    match: (p: string) => p.startsWith('/setlists'),
  },
  {
    id: 'perform',
    label: 'Perform',
    icon: Music2,
    href: '/perform',
    match: (p: string) => p.startsWith('/perform'),
  },
  {
    id: 'printer',
    label: 'Printer',
    icon: Printer,
    href: '/printer',
    match: (p: string) => p.startsWith('/printer'),
  },
];

export function Header() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Hide the tab strip on full-screen performance screens
  const isPerformScreen =
    (pathname.startsWith('/perform/') && pathname.split('/').length === 3) ||
    (pathname.includes('/perform') && pathname.split('/').length >= 4);

  // Scroll active tab into view on route change
  useEffect(() => {
    if (activeTabRef.current && tabsRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-40 no-print">
        {/* Blurred glass background */}
        <div className="absolute inset-0 bg-surface/80 backdrop-blur-xl border-b border-border/50" />

        <div className="relative z-10">
          {/* Top row: menu + logo */}
          <div className="flex items-center h-14 px-4 sm:px-6 gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-text-secondary hover:text-white transition-colors focus:outline-none shrink-0"
            >
              <Menu size={22} />
            </button>
            <Link href="/" className="flex-shrink-0 flex items-center space-x-2.5 group">
              <img src="/icon.jpg" alt="ChordCraft Logo" className="w-7 h-7 rounded object-cover border border-white/5" />
              <span className="text-lg font-bold text-text-primary tracking-wide transition-all group-hover:drop-shadow-[0_0_8px_rgba(79,142,247,0.5)]">
                Chord<span className="text-accent-gradient">Craft</span>
              </span>
            </Link>
          </div>

          {/* Tab strip (hidden on performance screens) */}
          {!isPerformScreen && (
            <div
              ref={tabsRef}
              className="flex items-end overflow-x-auto scrollbar-none px-3 gap-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {TABS.map(tab => {
                const active = tab.match(pathname);
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    ref={active ? activeTabRef : undefined}
                    onClick={() => router.push(tab.href)}
                    className={`
                      relative flex items-center gap-1.5 px-4 py-2 text-xs font-bold
                      rounded-t-xl border border-b-0 transition-all duration-200
                      whitespace-nowrap shrink-0
                      ${active
                        ? 'bg-surface border-border text-text-primary shadow-[0_-2px_12px_rgba(0,0,0,0.3)] z-10 -mb-px pb-[calc(0.5rem+1px)]'
                        : 'bg-surface/30 border-transparent text-text-secondary hover:text-text-primary hover:bg-surface/60 mb-0.5'
                      }
                    `}
                  >
                    {/* Active top accent line */}
                    {active && (
                      <span className="absolute top-0 left-3 right-3 h-[2px] rounded-full bg-accent-gradient" />
                    )}
                    <Icon size={13} className={active ? 'text-accent-start' : ''} />
                    {tab.label}
                  </button>
                );
              })}
              {/* Right padding spacer */}
              <div className="w-3 shrink-0" />
            </div>
          )}
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
