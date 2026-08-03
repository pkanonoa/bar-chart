'use client';

import React from 'react';
import { useAuth } from '@/components/AuthProvider';
import { FolderBrowser } from '@/components/FolderBrowser';
import { Header } from '@/components/Header';
import { getFolder } from '@/lib/storage';
import { use } from 'react';

export default function LyricsFolderPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { user, loading: authLoading } = useAuth();
  const [folderName, setFolderName] = React.useState<string>('');

  React.useEffect(() => {
    getFolder(params.id).then(f => setFolderName(f?.name || 'Folder'));
  }, [params.id]);

  if (authLoading || !user) return <div className="flex h-screen items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <FolderBrowser folderId={params.id} folderName={folderName} kind="lyrics" />
      </main>
    </div>
  );
}
