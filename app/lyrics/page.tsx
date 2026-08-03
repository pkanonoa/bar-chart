'use client';

import { useAuth } from '@/components/AuthProvider';
import { FolderBrowser } from '@/components/FolderBrowser';

export default function LyricsHome() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <FolderBrowser folderId={null} kind="lyrics" />
      </main>
    </div>
  );
}
