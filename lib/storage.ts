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
};

export type Folder = {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  updated_at: string;
};

interface BarChartDB extends DBSchema {
  charts: {
    key: string;
    value: Chart;
  };
  folders: {
    key: string;
    value: Folder;
  };
  pending_saves: {
    key: string;
    value: { id: string; type: 'chart' | 'folder'; data: any; action: 'upsert' | 'delete' };
  };
}

let dbPromise: Promise<IDBPDatabase<BarChartDB>> | null = null;
if (typeof window !== 'undefined') {
  dbPromise = openDB<BarChartDB>('bar-chart-db', 1, {
    upgrade(db) {
      db.createObjectStore('charts', { keyPath: 'id' });
      db.createObjectStore('folders', { keyPath: 'id' });
      db.createObjectStore('pending_saves', { keyPath: 'id' });
    },
  });
}

// Utility to check network
const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;

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
        } else if (item.type === 'folder') {
          await supabase.from('folders').upsert(item.data);
        }
      } else if (item.action === 'delete') {
        if (item.type === 'chart') {
          await supabase.from('charts').delete().eq('id', item.id);
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

export async function listFolder(folderId: string | null) {
  if (isOnline()) {
    let foldersQuery = supabase.from('folders').select('*').order('updated_at', { ascending: false }).not('name', 'like', '__TRASH__:%');
    if (folderId) {
      foldersQuery = foldersQuery.eq('parent_id', folderId);
    } else {
      foldersQuery = foldersQuery.is('parent_id', null);
    }
    const foldersRes = await foldersQuery;

    let chartsQuery = supabase.from('charts').select('id, title, updated_at').order('updated_at', { ascending: false }).not('title', 'like', '__TRASH__:%');
    if (folderId) {
      chartsQuery = chartsQuery.eq('folder_id', folderId);
    } else {
      chartsQuery = chartsQuery.is('folder_id', null);
    }
    const chartsRes = await chartsQuery;

    if (foldersRes.data && dbPromise) {
      const db = await dbPromise;
      const tx = db.transaction('folders', 'readwrite');
      foldersRes.data.forEach((f) => tx.store.put(f));
    }
    return {
      folders: foldersRes.data || [],
      charts: (chartsRes.data || []).map((c) => ({ ...c, type: 'chart' })),
    };
  } else {
    if (!dbPromise) return { folders: [], charts: [] };
    const db = await dbPromise;
    const allFolders = await db.getAll('folders');
    const allCharts = await db.getAll('charts');
    const folders = allFolders.filter((f) => f.parent_id === folderId && !f.name.startsWith('__TRASH__:'));
    const charts = allCharts.filter((c) => c.folder_id === folderId && !c.title.startsWith('__TRASH__:'));
    return {
      folders,
      charts: charts.map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at, type: 'chart' })),
    };
  }
}

export async function createFolder(parentId: string | null, name: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const folder: Folder = {
    id: crypto.randomUUID(),
    name,
    parent_id: parentId,
    created_by: user?.id || '',
    updated_at: new Date().toISOString(),
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

export async function renameEntry(id: string, type: 'folder' | 'chart', newName: string) {
  const updated_at = new Date().toISOString();
  if (isOnline()) {
    if (type === 'folder') {
      await supabase.from('folders').update({ name: newName, updated_at }).eq('id', id);
    } else {
      await supabase.from('charts').update({ title: newName, updated_at }).eq('id', id);
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : 'charts';
    const existing = await db.get(storeName, id);
    if (existing) {
      const updated = type === 'folder' ? { ...existing, name: newName, updated_at } : { ...existing, title: newName, updated_at };
      await db.put(storeName, updated);
      await db.put('pending_saves', { id, type, data: updated, action: 'upsert' });
    }
  }
}

export async function deleteEntry(id: string, type: 'folder' | 'chart') {
  if (isOnline()) {
    // Relying on ON DELETE CASCADE in Supabase
    if (type === 'folder') {
      await supabase.from('folders').delete().eq('id', id);
    } else {
      await supabase.from('charts').delete().eq('id', id);
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : 'charts';
    await db.delete(storeName, id);
    await db.put('pending_saves', { id, type, data: null, action: 'delete' });
  }
}

export async function moveToTrash(id: string, type: 'folder' | 'chart') {
  const updated_at = new Date().toISOString();
  
  // First, get the current entry to know its name and parent
  let existingName = '';
  let existingParentId: string | null = null;
  
  if (isOnline()) {
    if (type === 'folder') {
      const { data } = await supabase.from('folders').select('name, parent_id').eq('id', id).single();
      if (data) { existingName = data.name; existingParentId = data.parent_id; }
    } else {
      const { data } = await supabase.from('charts').select('title, folder_id').eq('id', id).single();
      if (data) { existingName = data.title; existingParentId = data.folder_id; }
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : 'charts';
    const existing = await db.get(storeName, id);
    if (existing) {
      if (type === 'folder') { existingName = (existing as Folder).name; existingParentId = (existing as Folder).parent_id; }
      else { existingName = (existing as Chart).title; existingParentId = (existing as Chart).folder_id; }
    }
  }
  
  if (!existingName) return;
  
  const trashedName = `__TRASH__:${existingParentId || 'root'}:${existingName}`;
  
  if (isOnline()) {
    if (type === 'folder') {
      await supabase.from('folders').update({ name: trashedName, parent_id: null, updated_at }).eq('id', id);
    } else {
      await supabase.from('charts').update({ title: trashedName, folder_id: null, updated_at }).eq('id', id);
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : 'charts';
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

export async function restoreFromTrash(id: string, type: 'folder' | 'chart', trashedName: string) {
  const updated_at = new Date().toISOString();
  
  // Parse the trashed name: __TRASH__:{original_parent_id}:{original_name}
  const parts = trashedName.split(':');
  if (parts.length < 3 || parts[0] !== '__TRASH__') return;
  
  const originalParentIdRaw = parts[1];
  const originalParentId = originalParentIdRaw === 'root' ? null : originalParentIdRaw;
  const originalName = parts.slice(2).join(':');
  
  if (isOnline()) {
    if (type === 'folder') {
      await supabase.from('folders').update({ name: originalName, parent_id: originalParentId, updated_at }).eq('id', id);
    } else {
      await supabase.from('charts').update({ title: originalName, folder_id: originalParentId, updated_at }).eq('id', id);
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : 'charts';
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
    return {
      folders: foldersRes.data || [],
      charts: (chartsRes.data || []).map((c) => ({ ...c, type: 'chart' })),
    };
  } else if (dbPromise) {
    const db = await dbPromise;
    const allFolders = await db.getAll('folders');
    const allCharts = await db.getAll('charts');
    const folders = allFolders.filter((f) => f.name.startsWith('__TRASH__:'));
    const charts = allCharts.filter((c) => c.title.startsWith('__TRASH__:'));
    return {
      folders,
      charts: charts.map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at, type: 'chart' })),
    };
  }
  return { folders: [], charts: [] };
}

export async function moveEntry(id: string, type: 'folder' | 'chart', newParentId: string | null) {
  const updated_at = new Date().toISOString();
  if (isOnline()) {
    if (type === 'folder') {
      await supabase.from('folders').update({ parent_id: newParentId, updated_at }).eq('id', id);
    } else {
      await supabase.from('charts').update({ folder_id: newParentId, updated_at }).eq('id', id);
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    const storeName = type === 'folder' ? 'folders' : 'charts';
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
  if (isOnline()) {
    const { custom_text, type, ...dbPayload } = chart as any;
    const { error } = await supabase.from('charts').upsert(dbPayload);
    if (error) {
      console.error('Failed to save chart:', error);
      throw error;
    }
  } else if (dbPromise) {
    const db = await dbPromise;
    await db.put('pending_saves', { id: chart.id, type: 'chart', data: chart, action: 'upsert' });
  }
  await cacheChart(chart);
}

export async function readChart(id: string): Promise<Chart | null> {
  if (isOnline()) {
    const { data } = await supabase.from('charts').select('*').eq('id', id).single();
    if (data) await cacheChart(data);
    return data;
  } else if (dbPromise) {
    const db = await dbPromise;
    return (await db.get('charts', id)) || null;
  }
  return null;
}

export async function getRecentCharts(limit: number = 5) {
  if (isOnline()) {
    const { data } = await supabase.from('charts').select('id, title, updated_at').not('title', 'like', '__TRASH__:%').order('updated_at', { ascending: false }).limit(limit);
    return data || [];
  } else if (dbPromise) {
    const db = await dbPromise;
    const allCharts = await db.getAll('charts');
    return allCharts.filter(c => !c.title.startsWith('__TRASH__:'))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, limit);
  }
  return [];
}

export async function getAllFolders(): Promise<Folder[]> {
  if (isOnline()) {
    const { data } = await supabase.from('folders').select('*');
    return data || [];
  } else if (dbPromise) {
    const db = await dbPromise;
    return await db.getAll('folders');
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

export async function searchAll(query: string, rootFolderId: string | null = null) {
  let charts: any[] = [];
  if (isOnline()) {
    const { data } = await supabase.from('charts').select('id, title, updated_at, folder_id').ilike('title', `%${query}%`).not('title', 'like', '__TRASH__:%');
    charts = data || [];
  } else if (dbPromise) {
    const db = await dbPromise;
    const all = await db.getAll('charts');
    charts = all.filter((c) => !c.title.startsWith('__TRASH__:') && c.title.toLowerCase().includes(query.toLowerCase()));
  }

  const folders = await getAllFolders();
  const folderMap = new Map(folders.map(f => [f.id, f]));

  const results = charts.map(c => {
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
      type: 'chart',
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

export function getPendingSavesCount() {
  if (!dbPromise) return Promise.resolve(0);
  return dbPromise.then((db) => db.count('pending_saves'));
}
