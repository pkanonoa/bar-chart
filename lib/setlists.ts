import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Setlist = {
  id: string;
  name: string;
  date: string | null;
  notes: string | null;
  created_by: string;
  updated_at: string;
};

export type SetlistItem = {
  id: string;
  setlist_id: string;
  item_type: 'chart' | 'lyrics';
  item_id: string;
  position: number;
  transpose_override: number | null;
  notes: string | null;
  // display fields populated by join
  title?: string;
};

// ─── Setlist CRUD ─────────────────────────────────────────────────────────────

export async function listSetlists(): Promise<Setlist[]> {
  const { data, error } = await supabase
    .from('setlists')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createSetlist(
  name: string,
  date?: string | null,
  notes?: string | null,
): Promise<Setlist> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('setlists')
    .insert({
      name,
      date: date || null,
      notes: notes || null,
      created_by: user?.id,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSetlist(
  id: string,
  patch: Partial<Pick<Setlist, 'name' | 'date' | 'notes'>>,
): Promise<void> {
  const { error } = await supabase
    .from('setlists')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSetlist(id: string): Promise<void> {
  const { error } = await supabase.from('setlists').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateSetlist(id: string): Promise<Setlist> {
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch original
  const { data: original, error: fetchErr } = await supabase
    .from('setlists')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchErr || !original) throw fetchErr || new Error('Not found');

  // Fetch items
  const { data: items } = await supabase
    .from('setlist_items')
    .select('*')
    .eq('setlist_id', id)
    .order('position');

  // Insert new setlist
  const { data: newSetlist, error: insErr } = await supabase
    .from('setlists')
    .insert({
      name: `${original.name} (copy)`,
      date: original.date,
      notes: original.notes,
      created_by: user?.id,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (insErr || !newSetlist) throw insErr || new Error('Insert failed');

  // Duplicate items
  if (items && items.length > 0) {
    const newItems = items.map((item: SetlistItem) => ({
      setlist_id: newSetlist.id,
      item_type: item.item_type,
      item_id: item.item_id,
      position: item.position,
      transpose_override: item.transpose_override,
      notes: item.notes,
    }));
    await supabase.from('setlist_items').insert(newItems);
  }

  return newSetlist;
}

// ─── Setlist Items CRUD ───────────────────────────────────────────────────────

export async function listSetlistItems(setlistId: string): Promise<SetlistItem[]> {
  const { data: rawItems, error } = await supabase
    .from('setlist_items')
    .select('*')
    .eq('setlist_id', setlistId)
    .order('position');
  if (error) throw error;
  if (!rawItems || rawItems.length === 0) return [];

  // Enrich with titles from charts + lyrics
  const chartIds = rawItems.filter(i => i.item_type === 'chart').map(i => i.item_id);
  const lyricsIds = rawItems.filter(i => i.item_type === 'lyrics').map(i => i.item_id);

  const titleMap: Record<string, string> = {};

  if (chartIds.length > 0) {
    const { data: charts } = await supabase
      .from('charts')
      .select('id, title')
      .in('id', chartIds);
    (charts || []).forEach(c => { titleMap[c.id] = c.title; });
  }
  if (lyricsIds.length > 0) {
    const { data: lyrics } = await supabase
      .from('lyrics')
      .select('id, title')
      .in('id', lyricsIds);
    (lyrics || []).forEach(l => { titleMap[l.id] = l.title; });
  }

  return rawItems.map(item => ({
    ...item,
    title: titleMap[item.item_id] || 'Unknown',
  }));
}

export async function addSetlistItems(
  setlistId: string,
  items: Array<{ item_type: 'chart' | 'lyrics'; item_id: string }>,
  startPosition: number,
): Promise<SetlistItem[]> {
  const rows = items.map((item, i) => ({
    setlist_id: setlistId,
    item_type: item.item_type,
    item_id: item.item_id,
    position: startPosition + i,
  }));
  const { data, error } = await supabase
    .from('setlist_items')
    .insert(rows)
    .select();
  if (error) throw error;
  
  // Bump updated_at on parent setlist
  await supabase
    .from('setlists')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', setlistId);

  return data || [];
}

export async function updateSetlistItem(
  id: string,
  patch: Partial<Pick<SetlistItem, 'transpose_override' | 'notes'>>,
): Promise<void> {
  const { error } = await supabase
    .from('setlist_items')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function removeSetlistItem(id: string, setlistId: string): Promise<void> {
  const { error } = await supabase.from('setlist_items').delete().eq('id', id);
  if (error) throw error;
  await supabase
    .from('setlists')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', setlistId);
}

export async function reorderSetlistItems(
  items: Array<{ id: string; position: number }>,
): Promise<void> {
  // Supabase doesn't support bulk update in one shot cleanly, so we use upsert
  const rows = items.map(({ id, position }) => ({ id, position }));
  // Fire individual updates in parallel
  await Promise.all(
    rows.map(({ id, position }) =>
      supabase.from('setlist_items').update({ position }).eq('id', id),
    ),
  );
}
