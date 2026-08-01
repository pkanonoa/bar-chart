'use client';

import { useAuth } from '@/components/AuthProvider';
import { FolderBrowser } from '@/components/FolderBrowser';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center bg-gray-950 text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <FolderBrowser folderId={null} />
      </main>
    </div>
  );
}
