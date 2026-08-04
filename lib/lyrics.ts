import { supabase } from './supabase';
import { getDBPromise } from './storage';

export type Lyric = {
  id: string;
  title: string;
  body: string;
  folder_id: string | null;
  created_by: string;
  updated_at: string;
  is_bookmarked?: boolean;
};

const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

async function cacheLyric(lyric: Lyric) {
  const dbPromise = getDBPromise();
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('lyrics', lyric);
}

export async function saveLyrics(lyric: Lyric) {
  lyric.updated_at = new Date().toISOString();
  if (isOnline()) {
    const { type, ...dbPayload } = lyric as any;
    const { error } = await supabase.from('lyrics').upsert(dbPayload);
    if (error) {
      console.error('Failed to save lyrics:', JSON.stringify(error));
      throw error;
    }
  } else {
    const dbPromise = getDBPromise();
    if (dbPromise) {
      const db = await dbPromise;
      await db.put('pending_saves', { id: lyric.id, type: 'lyrics', data: lyric, action: 'upsert' });
    }
  }
  await cacheLyric(lyric);
}

export async function readLyrics(id: string): Promise<Lyric | null> {
  if (isOnline()) {
    const { data } = await supabase.from('lyrics').select('*').eq('id', id).single();
    if (data) await cacheLyric(data);
    return data;
  } else {
    const dbPromise = getDBPromise();
    if (dbPromise) {
      const db = await dbPromise;
      return (await db.get('lyrics', id)) || null;
    }
  }
  return null;
}

export async function getRecentLyrics(limit: number = 5) {
  if (isOnline()) {
    const { data } = await supabase.from('lyrics').select('id, title, updated_at, is_bookmarked').not('title', 'like', '__TRASH__:%').order('updated_at', { ascending: false }).limit(limit);
    return data || [];
  } else {
    const dbPromise = getDBPromise();
    if (dbPromise) {
      const db = await dbPromise;
      const allLyrics = await db.getAll('lyrics');
      return allLyrics.filter(c => !c.title.startsWith('__TRASH__:'))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, limit);
    }
  }
  return [];
}

export async function exportLyrics(id: string) {
  const lyric = await readLyrics(id);
  if (!lyric) return;
  const blob = new Blob([JSON.stringify(lyric, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${lyric.title || 'export'}.lyrics`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importLyrics(file: File, targetFolderId: string | null) {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const lyricsData = JSON.parse(content);
        const { data: { user } } = await supabase.auth.getUser();
        const newLyric: Lyric = {
          ...lyricsData,
          id: crypto.randomUUID(),
          folder_id: targetFolderId,
          created_by: user?.id || '',
          updated_at: new Date().toISOString(),
        };
        await saveLyrics(newLyric);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
