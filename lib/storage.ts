import { supabase } from './supabase';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type Chart = {
  id: string;
  title: string;
  tempo: number | null;
  time_sig: string | null;
  lines: any;
  semitone_offset: number;
  prefer_flats: boolean;
  folder_id: string | null;
  created_by: string;
  updated_at: string;
  is_bookmarked?: boolean;
};

export type Folder = {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  updated_at: string;
  kind: 'chart' | 'lyrics';
};

interface BarChartDB extends DBSchema {
  charts: {
    key: string;
    value: Chart;
  };
  lyrics: {
    key: string;
    value: any; 
  };
  folders: {
    key: string;
    value: Folder;
  };
  pending_saves: {
    key: string;
    value: { id: string; type: 'chart' | 'folder' | 'lyrics'; data: any; action: 'upsert' | 'delete' };
  };
}

let dbPromise: Promise<IDBPDatabase<BarChartDB>> | null = null;
if (typeof window !== 'undefined') {
  dbPromise = openDB<BarChartDB>('bar-chart-db', 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('charts', { keyPath: 'id' });
        db.createObjectStore('folders', { keyPath: 'id' });
        db.createObjectStore('pending_saves', { keyPath: 'id' });
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('lyrics')) {
          db.createObjectStore('lyrics', { keyPath: 'id' });
        }
      }
      // Add version 3 catch-all just in case
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('lyrics')) {
          db.createObjectStore('lyrics', { keyPath: 'id' });
        }
      }
    },
  });
}

export const getDBPromise = () => dbPromise;

// Utility to check network and guest mode state
const isOnline = () => {
  if (typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true') {
    return false;
  }
  return typeof navigator !== 'undefined' && navigator.onLine;
};

// Flush pending saves when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    if (!dbPromise) return;
    const db = await dbPromise;
    const pending = await db.getAll('pending_saves');
    for (const item of pending) {
      if (item.action === 'upsert') {
        if (item.type === 'chart') {
          const { custom_text, type, ...dbPayload } = item.data;
          await supabase.from('charts').upsert(dbPayload);
        } else if (item.type === 'lyrics') {
          const { type, ...dbPayload } = item.data;
          await supabase.from('lyrics').upsert(dbPayload);
        } else if (item.type === 'folder') {
          await supabase.from('folders').upsert(item.data);
        }
      } else if (item.action === 'delete') {
        if (item.type === 'chart') {
          await supabase.from('charts').delete().eq('id', item.id);
        } else if (item.type === 'lyrics') {
          await supabase.from('lyrics').delete().eq('id', item.id);
        } else if (item.type === 'folder') {
          await supabase.from('folders').delete().eq('id', item.id);
        }
      }
      await db.delete('pending_saves', item.id);
    }
  });
}

// Cache updating utilities
async function cacheChart(chart: Chart) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('charts', chart);
}

async function cacheFolder(folder: Folder) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.put('folders', folder);
}

// --- Data Access Layer ---

export async function listFolder(folderId: string | null, kind: 'chart' | 'lyrics' = 'chart') {
  if (isOnline()) {
    let foldersQuery = supabase.from('folders').select('*').eq('kind', kind).order('updated_at', { ascending: false }).not('name', 'like', '__TRASH__:%');
    if (folderId) {
      foldersQuery = foldersQuery.eq('parent_id', folderId);
    } else {
      foldersQuery = foldersQuery.is('parent_id', null);
    }
    const foldersRes = await foldersQuery;

    let itemsQuery;
    if (kind === 'chart') {
      itemsQuery = supabase.from('charts').select('id, title, updated_at, is_bookmarked').order('updated_at', { ascending: false }).not('title', 'like', '__TRASH__:%');
    } else {
      itemsQuery = supabase.from('lyrics').select('id, title, updated_at, is_bookmarked').order('updated_at', { ascending: false }).not('title', 'like', '__TRASH__:%');
    }
    
    if (folderId) {
      itemsQuery = itemsQuery.eq('folder_id', folderId);
    } else {
      itemsQuery = itemsQuery.is('folder_id', null);
    }
    const itemsRes = await itemsQuery;

    if (foldersRes.data && dbPromise) {
      const db = await dbPromise;
      const tx = db.transaction('folders', 'readwrite');
      foldersRes.data.forEach((f) => tx.store.put(f));
    }
    return {
      folders: foldersRes.data || [],
      charts: (itemsRes.data || []).map((c) => ({ ...c, type: kind })),
    };
  } else {
    if (!dbPromise) return { folders: [], charts: [] };
    const db = await dbPromise;
    const allFolders = await db.getAll('folders');
    const allItems = await db.getAll(kind === 'chart' ? 'charts' : 'lyrics');
    const folders = allFolders.filter((f) => f.parent_id === folderId && f.kind === kind && !f.name.startsWith('__TRASH__:'));
    const items = allItems.filter((c) => c.folder_id === folderId && !c.title.startsWith('__TRASH__:'));
    return {
      folders,
      charts: items.map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at, is_bookmarked: c.is_bookmarked, type: kind })),
    };
  }
}

export async function createFolder(parentId: string | null, name: string, kind: 'chart' | 'lyrics' = 'chart') {
  const { data: { user } } = await supabase.auth.getUser();
  const folder: Folder = {
    id: crypto.randomUUID(),
    name,
    parent_id: parentId,
    created_by: user?.id || '',
    updated_at: new Date().toISOString(),
    kind,
  };

  if (isOnline()) {
    await supabase.from('folders').insert(folder);
  } else if (dbPromise) {
    const db = await dbPromise;
    await db.put('pending_saves', { id: folder.id, type: 'folder', data: folder, action: 'upsert' });
  }
  await cacheFolder(folder);
  return folder;
}

export async function renameEntry(id: string, type: 'folder' | 'chart' | 'lyrics', newName: string) {
  const updated_at = new Date().toISOString();
  if (isOnline()) {
    if (type === 'folder') {
      await supabase.from('folders').update({ name: newName, updated_at }).eq('id', id);
    } else if (type === 'chart') {
      await supabase.from('charts').update({ title: newName, updated_at }).eq('id', id);
    } else if (type === 'lyrics') {
      await supabase.from('lyrics').update({ title: newName, updated_at }).eq('id', id);
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';
    const existing = await db.get(storeName, id);
    if (existing) {
      const updated = type === 'folder' ? { ...existing, name: newName, updated_at } : { ...existing, title: newName, updated_at };
      await db.put(storeName, updated);
      await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
    }
  }
}

export async function toggleBookmark(id: string, type: 'chart' | 'lyrics', is_bookmarked: boolean) {
  const updated_at = new Date().toISOString();
  if (isOnline()) {
    if (type === 'chart') {
      await supabase.from('charts').update({ is_bookmarked, updated_at }).eq('id', id);
    } else if (type === 'lyrics') {
      await supabase.from('lyrics').update({ is_bookmarked, updated_at }).eq('id', id);
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'chart' ? 'charts' : 'lyrics';
    const existing = await db.get(storeName, id);
    if (existing) {
      const updated = { ...existing, is_bookmarked, updated_at };
      await db.put(storeName, updated);
      await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
    }
  }
}

export async function deleteEntry(id: string, type: 'folder' | 'chart' | 'lyrics') {
  if (isOnline()) {
    // Relying on ON DELETE CASCADE in Supabase
    if (type === 'folder') {
      await supabase.from('folders').delete().eq('id', id);
    } else if (type === 'chart') {
      await supabase.from('charts').delete().eq('id', id);
    } else if (type === 'lyrics') {
      await supabase.from('lyrics').delete().eq('id', id);
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';
    await db.delete(storeName, id);
    await db.put('pending_saves', { id, type, data: null, action: 'delete' });
  }
}

export async function moveToTrash(id: string, type: 'folder' | 'chart' | 'lyrics') {
  const updated_at = new Date().toISOString();
  
  let existingName = '';
  let existingParentId: string | null = null;
  
  if (isOnline()) {
    if (type === 'folder') {
      const { data } = await supabase.from('folders').select('name, parent_id').eq('id', id).single();
      if (data) { existingName = data.name; existingParentId = data.parent_id; }
    } else if (type === 'chart') {
      const { data } = await supabase.from('charts').select('title, folder_id').eq('id', id).single();
      if (data) { existingName = data.title; existingParentId = data.folder_id; }
    } else if (type === 'lyrics') {
      const { data } = await supabase.from('lyrics').select('title, folder_id').eq('id', id).single();
      if (data) { existingName = data.title; existingParentId = data.folder_id; }
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';
    const existing = await db.get(storeName, id);
    if (existing) {
      if (type === 'folder') { existingName = (existing as Folder).name; existingParentId = (existing as Folder).parent_id; }
      else { existingName = (existing as any).title; existingParentId = (existing as any).folder_id; }
    }
  }
  
  if (!existingName) return;
  
  const trashedName = `__TRASH__:${existingParentId || 'root'}:${existingName}`;
  
  if (isOnline()) {
    if (type === 'folder') {
      await supabase.from('folders').update({ name: trashedName, parent_id: null, updated_at }).eq('id', id);
    } else if (type === 'chart') {
      await supabase.from('charts').update({ title: trashedName, folder_id: null, updated_at }).eq('id', id);
    } else if (type === 'lyrics') {
      await supabase.from('lyrics').update({ title: trashedName, folder_id: null, updated_at }).eq('id', id);
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';
    const existing = await db.get(storeName, id);
    if (existing) {
      const updated: any = { ...existing, updated_at };
      if (type === 'folder') { updated.name = trashedName; updated.parent_id = null; }
      else { updated.title = trashedName; updated.folder_id = null; }
      await db.put(storeName, updated);
      await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
    }
  }
}

export async function restoreFromTrash(id: string, type: 'folder' | 'chart' | 'lyrics', trashedName: string) {
  const updated_at = new Date().toISOString();
  
  const parts = trashedName.split(':');
  if (parts.length < 3 || parts[0] !== '__TRASH__') return;
  
  const originalParentIdRaw = parts[1];
  const originalParentId = originalParentIdRaw === 'root' ? null : originalParentIdRaw;
  const originalName = parts.slice(2).join(':');
  
  if (isOnline()) {
    if (type === 'folder') {
      await supabase.from('folders').update({ name: originalName, parent_id: originalParentId, updated_at }).eq('id', id);
    } else if (type === 'chart') {
      await supabase.from('charts').update({ title: originalName, folder_id: originalParentId, updated_at }).eq('id', id);
    } else if (type === 'lyrics') {
      await supabase.from('lyrics').update({ title: originalName, folder_id: originalParentId, updated_at }).eq('id', id);
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';
    const existing = await db.get(storeName, id);
    if (existing) {
      const updated: any = { ...existing, updated_at };
      if (type === 'folder') { updated.name = originalName; updated.parent_id = originalParentId; }
      else { updated.title = originalName; updated.folder_id = originalParentId; }
      await db.put(storeName, updated);
      await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
    }
  }
}

export async function listTrash() {
  if (isOnline()) {
    const foldersRes = await supabase.from('folders').select('*').like('name', '__TRASH__:%').order('updated_at', { ascending: false });
    const chartsRes = await supabase.from('charts').select('id, title, updated_at').like('title', '__TRASH__:%').order('updated_at', { ascending: false });
    const lyricsRes = await supabase.from('lyrics').select('id, title, updated_at').like('title', '__TRASH__:%').order('updated_at', { ascending: false });
    return {
      folders: foldersRes.data || [],
      charts: [
        ...(chartsRes.data || []).map((c) => ({ ...c, type: 'chart' })),
        ...(lyricsRes.data || []).map((l) => ({ ...l, type: 'lyrics' }))
      ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    };
  } else if (dbPromise) {
    const db = await dbPromise;
    const allFolders = await db.getAll('folders');
    const allCharts = await db.getAll('charts');
    const allLyrics = await db.getAll('lyrics');
    const folders = allFolders.filter((f) => f.name.startsWith('__TRASH__:'));
    const charts = allCharts.filter((c) => c.title.startsWith('__TRASH__:'));
    const lyrics = allLyrics.filter((l) => l.title.startsWith('__TRASH__:'));
    return {
      folders,
      charts: [
        ...charts.map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at, type: 'chart' })),
        ...lyrics.map((l) => ({ id: l.id, title: l.title, updated_at: l.updated_at, type: 'lyrics' }))
      ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    };
  }
  return { folders: [], charts: [] };
}

export async function moveEntry(id: string, type: 'folder' | 'chart' | 'lyrics', newParentId: string | null) {
  const updated_at = new Date().toISOString();
  if (isOnline()) {
    if (type === 'folder') {
      await supabase.from('folders').update({ parent_id: newParentId, updated_at }).eq('id', id);
    } else if (type === 'chart') {
      await supabase.from('charts').update({ folder_id: newParentId, updated_at }).eq('id', id);
    } else if (type === 'lyrics') {
      await supabase.from('lyrics').update({ folder_id: newParentId, updated_at }).eq('id', id);
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : type === 'chart' ? 'charts' : 'lyrics';
    const existing = await db.get(storeName, id);
    if (existing) {
      const updated: any = { ...existing, updated_at };
      if (type === 'folder') updated.parent_id = newParentId;
      else updated.folder_id = newParentId;
      await db.put(storeName, updated);
      await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
    }
  }
}

export async function saveChart(chart: Chart) {
  chart.updated_at = new Date().toISOString();
  let savedOnline = false;
  if (isOnline()) {
    try {
      const { custom_text, type, ...dbPayload } = chart as any;
      const { error } = await supabase.from('charts').upsert(dbPayload);
      if (!error) {
        savedOnline = true;
      }
    } catch (err) {
      console.warn('[Storage] Network error saving chart, queueing pending save:', err);
    }
  }
  if (!savedOnline && dbPromise) {
    const db = await dbPromise;
    await db.put('pending_saves', { id: chart.id, type: 'chart', data: chart, action: 'upsert' });
  }
  await cacheChart(chart);
}

export async function readChart(id: string, bypassCache = false): Promise<Chart | null> {
  if (isOnline()) {
    try {
      const { data, error } = await supabase.from('charts').select('*').eq('id', id).single();
      if (!error && data) {
        await cacheChart(data);
        return data;
      }
    } catch (err) {
      console.warn('[Storage] Network error reading chart, falling back to local storage:', err);
    }
  }
  if (dbPromise) {
    const db = await dbPromise;
    return (await db.get('charts', id)) || null;
  }
  return null;
}

export async function getRecentCharts(limit: number = 5) {
  if (isOnline()) {
    const { data } = await supabase.from('charts').select('id, title, updated_at, is_bookmarked').not('title', 'like', '__TRASH__:%').order('updated_at', { ascending: false }).limit(limit);
    return data || [];
  } else if (dbPromise) {
    const db = await dbPromise;
    const allCharts = await db.getAll('charts');
    return allCharts.filter(c => !c.title.startsWith('__TRASH__:'))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, limit);
  }
  return [];
}

export async function getAllFolders(kind?: 'chart' | 'lyrics'): Promise<Folder[]> {
  if (isOnline()) {
    let query = supabase.from('folders').select('*');
    if (kind) query = query.eq('kind', kind);
    const { data } = await query;
    return data || [];
  } else if (dbPromise) {
    const db = await dbPromise;
    const all = await db.getAll('folders');
    if (kind) return all.filter(f => f.kind === kind);
    return all;
  }
  return [];
}

export async function getFolder(id: string): Promise<Folder | null> {
  if (isOnline()) {
    const { data } = await supabase.from('folders').select('*').eq('id', id).single();
    if (data && dbPromise) {
      const db = await dbPromise;
      await db.put('folders', data);
    }
    return data;
  } else if (dbPromise) {
    const db = await dbPromise;
    return (await db.get('folders', id)) || null;
  }
  return null;
}

export async function getBookmarks() {
  if (isOnline()) {
    const [{ data: charts }, { data: lyrics }] = await Promise.all([
      supabase.from('charts').select('id, title, updated_at, is_bookmarked').eq('is_bookmarked', true).not('title', 'like', '__TRASH__:%').order('updated_at', { ascending: false }),
      supabase.from('lyrics').select('id, title, updated_at, is_bookmarked').eq('is_bookmarked', true).not('title', 'like', '__TRASH__:%').order('updated_at', { ascending: false })
    ]);
    const all = [
      ...(charts || []).map((c) => ({ ...c, type: 'chart' as const })),
      ...(lyrics || []).map((l) => ({ ...l, type: 'lyrics' as const }))
    ];
    return all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  } else if (dbPromise) {
    const db = await dbPromise;
    const charts = await db.getAll('charts');
    const lyrics = await db.getAll('lyrics');
    const all = [
      ...charts.filter(c => c.is_bookmarked && !c.title.startsWith('__TRASH__:')).map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at, is_bookmarked: c.is_bookmarked, type: 'chart' as const })),
      ...lyrics.filter(l => l.is_bookmarked && !l.title.startsWith('__TRASH__:')).map((l) => ({ id: l.id, title: l.title, updated_at: l.updated_at, is_bookmarked: l.is_bookmarked, type: 'lyrics' as const }))
    ];
    return all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }
  return [];
}

export async function searchAll(query: string, rootFolderId: string | null = null, kind: 'chart' | 'lyrics' = 'chart') {
  let items: any[] = [];
  if (isOnline()) {
    const tableName = kind === 'chart' ? 'charts' : 'lyrics';
    const { data } = await supabase.from(tableName).select('id, title, updated_at, folder_id').ilike('title', `%${query}%`).not('title', 'like', '__TRASH__:%');
    items = data || [];
  } else if (dbPromise) {
    const db = await dbPromise;
    const all = await db.getAll(kind === 'chart' ? 'charts' : 'lyrics');
    items = all.filter((c) => !c.title.startsWith('__TRASH__:') && c.title.toLowerCase().includes(query.toLowerCase()));
  }

  const folders = await getAllFolders();
  const folderMap = new Map(folders.map(f => [f.id, f]));

  const results = items.map(c => {
    const pathParts = [];
    let currentFolder = c.folder_id ? folderMap.get(c.folder_id) : null;
    let isDescendant = false;

    while (currentFolder) {
      if (rootFolderId && currentFolder.id === rootFolderId) isDescendant = true;
      pathParts.unshift(currentFolder.name);
      currentFolder = currentFolder.parent_id ? folderMap.get(currentFolder.parent_id) : null;
    }

    if (rootFolderId && c.folder_id === rootFolderId) isDescendant = true;

    return {
      ...c,
      type: kind,
      path: pathParts.length > 0 ? 'Home / ' + pathParts.join(' / ') : 'Home',
      isDescendant: rootFolderId === null ? true : isDescendant
    };
  });

  return results.filter(r => r.isDescendant);
}

export async function exportChart(id: string) {
  const chart = await readChart(id);
  if (!chart) return;
  const blob = new Blob([JSON.stringify(chart, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${chart.title || 'export'}.barchart`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importChart(file: File, targetFolderId: string | null) {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const chartData = JSON.parse(content);
        const { data: { user } } = await supabase.auth.getUser();
        const newChart: Chart = {
          ...chartData,
          id: crypto.randomUUID(), // always assign a new id
          folder_id: targetFolderId,
          created_by: user?.id || '',
          updated_at: new Date().toISOString(),
        };
        await saveChart(newChart);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

export async function saveLyrics(lyrics: any) {
  lyrics.updated_at = new Date().toISOString();
  if (isOnline()) {
    const { type, ...dbPayload } = lyrics;
    const { error } = await supabase.from('lyrics').upsert(dbPayload);
    if (error) {
      console.error('Failed to save lyrics:', error);
      throw error;
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    await db.put('pending_saves', { id: lyrics.id, type: 'lyrics', data: lyrics, action: 'upsert' });
  }
  if (dbPromise) {
    const db = await dbPromise;
    await db.put('lyrics', lyrics);
  }
}

export async function readLyrics(id: string): Promise<any | null> {
  if (isOnline()) {
    const { data } = await supabase.from('lyrics').select('*').eq('id', id).single();
    if (data && dbPromise) {
      const db = await dbPromise;
      await db.put('lyrics', data);
    }
    return data;
  } else if (dbPromise) {
    const db = await dbPromise;
    return (await db.get('lyrics', id)) || null;
  }
  return null;
}

export async function exportLyrics(id: string) {
  const lyrics = await readLyrics(id);
  if (!lyrics) return;
  const blob = new Blob([lyrics.body || ''], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${lyrics.title || 'export'}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importLyrics(file: File, targetFolderId: string | null) {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        
        let title = file.name.replace(/\.(txt|lyrics)$/i, '');
        let body = content;

        // basic heuristic to see if it's JSON from a previous lyrics export
        try {
          const parsed = JSON.parse(content);
          if (parsed.title && parsed.body) {
            title = parsed.title;
            body = parsed.body;
          }
        } catch(e) { }

        const { data: { user } } = await supabase.auth.getUser();
        const newLyrics = {
          id: crypto.randomUUID(),
          title,
          body,
          folder_id: targetFolderId,
          created_by: user?.id || '',
          updated_at: new Date().toISOString(),
        };
        await saveLyrics(newLyrics);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

export async function syncAllOffline(): Promise<{ chartsCount: number; lyricsCount: number; foldersCount: number }> {
  if (!isOnline()) {
    return { chartsCount: 0, lyricsCount: 0, foldersCount: 0 };
  }
  try {
    const [{ data: charts }, { data: lyrics }, { data: folders }] = await Promise.all([
      supabase.from('charts').select('*').not('title', 'like', '__TRASH__:%'),
      supabase.from('lyrics').select('*').not('title', 'like', '__TRASH__:%'),
      supabase.from('folders').select('*').not('name', 'like', '__TRASH__:%'),
    ]);

    if (dbPromise) {
      const db = await dbPromise;
      if (charts && charts.length > 0) {
        const tx = db.transaction('charts', 'readwrite');
        for (const c of charts) {
          await tx.store.put(c);
        }
        await tx.done;
      }
      if (lyrics && lyrics.length > 0) {
        const tx = db.transaction('lyrics', 'readwrite');
        for (const l of lyrics) {
          await tx.store.put(l);
        }
        await tx.done;
      }
      if (folders && folders.length > 0) {
        const tx = db.transaction('folders', 'readwrite');
        for (const f of folders) {
          await tx.store.put(f);
        }
        await tx.done;
      }
    }
    return {
      chartsCount: charts?.length || 0,
      lyricsCount: lyrics?.length || 0,
      foldersCount: folders?.length || 0,
    };
  } catch (err) {
    console.warn('[Sync] Full offline sync failed:', err);
    return { chartsCount: 0, lyricsCount: 0, foldersCount: 0 };
  }
}

export function getPendingSavesCount() {
  if (!dbPromise) return Promise.resolve(0);
  return dbPromise.then((db) => db.count('pending_saves'));
}

