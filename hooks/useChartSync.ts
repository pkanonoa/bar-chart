import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ChartData } from '@/lib/chart-types';
import { readChart, saveChart } from '@/lib/storage';

export function useChartSync(chartId: string) {
  const [chart, setChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [collaborators, setCollaborators] = useState<string[]>([]);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const hasPendingChanges = useRef(false);
  const myEmail = useRef<string | null>(null);
  const latestChartRef = useRef<ChartData | null>(null);
  
  useEffect(() => {
    latestChartRef.current = chart;
  }, [chart]);

  useEffect(() => {
    let isMounted = true;
    
    readChart(chartId).then(data => {
      if (isMounted) {
        setChart(data as ChartData | null);
        setLoading(false);
      }
    });

    const channel = supabase.channel(`chart-${chartId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'update' }, (payload) => {
        if (isMounted && payload.payload) {
          setChart(prev => prev ? { ...prev, ...payload.payload } : payload.payload);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flatMap(p => p.map((u: any) => u.email || 'Anonymous'));
        if (isMounted) {
          // Filter out our own email if known
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
      
      if (hasPendingChanges.current && latestChartRef.current) {
        saveChart({
          ...latestChartRef.current,
          updated_at: new Date().toISOString()
        }).catch(() => {});
      }
    };
  }, [chartId]);

  const persistChart = async (chartToSave: ChartData) => {
    setSaveStatus('saving');
    try {
      await saveChart({
        ...chartToSave,
        updated_at: new Date().toISOString()
      });
      setSaveStatus('saved');
      hasPendingChanges.current = false;
    } catch (err) {
      setSaveStatus('offline');
    }
  };

  const forceSave = async () => {
    if (hasPendingChanges.current && latestChartRef.current) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await persistChart(latestChartRef.current);
    }
  };

  const updateChart = useCallback((partial: Partial<ChartData>) => {
    setChart(prev => {
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
        persistChart(updated);
      }, 1000);

      return updated;
    });
  }, []);

  return { chart, loading, saveStatus, collaborators, updateChart, forceSave };
}
