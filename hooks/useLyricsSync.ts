import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Lyric, readLyrics, saveLyrics } from '@/lib/lyrics';

export function useLyricsSync(lyricId: string) {
  const [lyric, setLyric] = useState<Lyric | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [collaborators, setCollaborators] = useState<string[]>([]);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const hasPendingChanges = useRef(false);
  const myEmail = useRef<string | null>(null);
  const latestLyricRef = useRef<Lyric | null>(null);
  
  useEffect(() => {
    latestLyricRef.current = lyric;
  }, [lyric]);

  useEffect(() => {
    let isMounted = true;
    
    readLyrics(lyricId).then(data => {
      if (isMounted) {
        setLyric(data as Lyric | null);
        setLoading(false);
      }
    });

    const channel = supabase.channel(`lyrics-${lyricId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'update' }, (payload) => {
        if (isMounted && payload.payload) {
          setLyric(prev => prev ? { ...prev, ...payload.payload } : payload.payload);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flatMap(p => p.map((u: any) => u.email || 'Anonymous'));
        if (isMounted) {
          const others = Array.from(new Set(users)).filter(e => e !== myEmail.current);
          setCollaborators(others);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && user.email) {
            myEmail.current = user.email;
            await channel.track({ email: user.email });
          }
        }
      });

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      supabase.removeChannel(channel);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      if (hasPendingChanges.current && latestLyricRef.current) {
        saveLyrics({
          ...latestLyricRef.current,
          updated_at: new Date().toISOString()
        }).catch(() => {});
      }
    };
  }, [lyricId]);

  const persistLyric = async (lyricToSave: Lyric) => {
    setSaveStatus('saving');
    try {
      await saveLyrics({
        ...lyricToSave,
        updated_at: new Date().toISOString()
      });
      setSaveStatus('saved');
      hasPendingChanges.current = false;
    } catch (err) {
      setSaveStatus('offline');
    }
  };

  const forceSave = async () => {
    if (hasPendingChanges.current && latestLyricRef.current) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await persistLyric(latestLyricRef.current);
    }
  };

  const updateLyric = useCallback((partial: Partial<Lyric>) => {
    setLyric(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'update',
        payload: partial
      });

      hasPendingChanges.current = true;
      setSaveStatus('saving');
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        persistLyric(updated);
      }, 1000);

      return updated;
    });
  }, []);

  return { lyric, loading, saveStatus, collaborators, updateLyric, forceSave };
}
