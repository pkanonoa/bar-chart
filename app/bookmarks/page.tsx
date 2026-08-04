'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBookmarks, toggleBookmark } from '@/lib/storage';
import { Header } from '@/components/Header';
import { FileText, Music, Star } from 'lucide-react';

export default function BookmarksPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    setLoading(true);
    const data = await getBookmarks();
    setItems(data);
    setLoading(false);
  };

  const handleToggleBookmark = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleBookmark(item.id, item.type, false); // removing from bookmarks
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto px-4 pt-[max(env(safe-area-inset-top,2rem),2rem)] pb-32">
        <div className="flex items-center gap-3 mb-8 mt-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight flex items-center gap-2">
              <Star size={28} className="text-yellow-500 fill-yellow-500" /> Bookmarks
            </h1>
            <p className="text-xs text-text-secondary font-medium mt-0.5">
              Your favorite charts and lyrics.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-solid"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center">
            <div className="mx-auto h-20 w-20 bg-surface-raised rounded-full shadow-inner border border-border flex items-center justify-center mb-6">
              <Star size={32} className="text-text-secondary opacity-50" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-bold text-text-primary mb-2">No bookmarks yet</h3>
            <p className="text-xs text-text-secondary">Tap the star icon on any chart or lyric to bookmark it.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {items.map(item => (
              <div
                key={item.id}
                className="bg-surface border border-border rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:shadow-hover hover:-translate-y-1 transition-all duration-200 relative group"
                onClick={() => router.push(item.type === 'lyrics' ? `/lyrics/${item.id}` : `/chart/${item.id}`)}
              >
                <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mb-4 shadow-inner border border-border">
                  {item.type === 'lyrics' ? (
                    <Music size={24} className="text-accent-start" />
                  ) : (
                    <FileText size={24} className="text-accent-start" />
                  )}
                </div>
                <p className="text-sm font-bold text-text-primary text-center w-full truncate">{item.title}</p>
                <p className="text-[10px] text-text-secondary mt-1">{new Date(item.updated_at).toLocaleDateString()}</p>
                
                <button
                  className="absolute bottom-3 right-3 p-1.5 rounded-full hover:bg-white/5 transition-colors"
                  onClick={(e) => handleToggleBookmark(item, e)}
                  title="Remove bookmark"
                >
                  <Star size={16} className="text-yellow-500 fill-yellow-500 opacity-100 group-hover:opacity-50 group-hover:hover:opacity-100 transition-opacity" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
