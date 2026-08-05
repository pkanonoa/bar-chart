'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { useParams, useRouter } from 'next/navigation';
import { Lyric } from '@/lib/lyrics';

const PiascoreLyricsReader = dynamic(
  () => import('@/components/PiascoreLyricsReader').then((mod) => mod.PiascoreLyricsReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent-start border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading lyrics score...</span>
        </div>
      </div>
    ),
  }
);

export default function LyricsViewer() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const lyricId = params.id as string;

  const { lyric, loading: lyricLoading } = useLyricsSync(lyricId);

  if (authLoading || lyricLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent-start border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading lyrics score...</span>
        </div>
      </div>
    );
  }

  if (!user || !lyric) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#121214] text-white gap-4">
        <p className="text-slate-400 text-sm">Lyrics not found or access denied.</p>
        <button
          onClick={() => router.push('/lyrics')}
          className="px-5 py-2.5 bg-accent-gradient font-bold rounded-xl text-white hover:brightness-110 transition-all"
        >
          Go to Lyrics Catalog
        </button>
      </div>
    );
  }

  return (
    <PiascoreLyricsReader
      initialLyric={lyric as Lyric}
      folderId={lyric.folder_id}
    />
  );
}
