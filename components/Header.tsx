'use client';

import { useAuth } from './AuthProvider';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { Sidebar } from './Sidebar';

export function Header() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <header className="bg-transparent sticky top-0 z-40 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 text-text-secondary hover:text-white transition-colors focus:outline-none"
              >
                <Menu size={24} />
              </button>
              <Link href="/" className="flex-shrink-0 flex items-center space-x-3 group">
                <img src="/icon.jpg" alt="ChordCraft Logo" className="w-8 h-8 rounded object-cover border border-white/5" />
                <span className="text-xl font-bold text-text-primary tracking-wide transition-all group-hover:drop-shadow-[0_0_8px_rgba(79,142,247,0.5)]">
                  Chord<span className="text-accent-gradient">Craft</span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
