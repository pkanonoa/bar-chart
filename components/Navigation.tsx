'use client';

import React from 'react';
import { Home, Type, ListMusic, Music2, Printer } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  {
    id: 'chords',
    label: 'Chords',
    icon: Home,
    href: '/',
    match: (p: string) => p === '/' || p.startsWith('/folder/') || p.startsWith('/chart/'),
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

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  // Hide tab bar on full-screen performance/viewer pages
  const hideOnPaths = ['/perform/', '/setlists/'];
  const isFullscreen = hideOnPaths.some(prefix =>
    pathname.includes(prefix) && (pathname.includes('/perform') || (pathname.split('/').length > 3 && !pathname.endsWith('/perform')))
  );

  // Actually: hide only on deep performance screens (not the builder pages)
  const isPerformScreen =
    (pathname.startsWith('/perform/') && pathname.split('/').length === 3) ||
    pathname.includes('/perform') && pathname.split('/').length >= 4;

  if (isPerformScreen) return null;

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 no-print">
        {/* Blurred background */}
        <div className="absolute inset-0 bg-surface/80 backdrop-blur-xl border-t border-border/50" />

        <div className="relative flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom,0px)]">
          {TABS.map(tab => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.href)}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-3 transition-all group ${
                  active ? 'text-accent-start' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {/* Active indicator bar */}
                <div className={`absolute top-0 w-8 h-[2px] rounded-full transition-all duration-300 ${
                  active ? 'bg-accent-gradient opacity-100' : 'opacity-0'
                }`} />

                {/* Icon with gradient bg when active */}
                <div className={`relative w-9 h-7 flex items-center justify-center rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-accent-gradient/15'
                    : 'group-hover:bg-white/5'
                }`}>
                  <Icon size={20} className={active ? 'text-accent-start' : ''} />
                </div>

                {/* Label */}
                <span className={`text-[10px] font-bold tracking-wide leading-none ${
                  active ? 'text-accent-start' : 'text-text-secondary'
                }`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Spacer so content isn't hidden behind tab bar */}
      <div className="h-16 pb-[env(safe-area-inset-bottom,0px)]" />
    </>
  );
}
