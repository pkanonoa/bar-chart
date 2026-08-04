import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export type PerformRole = 'leader' | 'follower' | 'loading';

export interface PerformancePresence {
  role: 'leader' | 'follower';
  name: string;
  currentIndex: number;
  chartIds?: string[];       // only leader tracks this
  sessionName?: string;      // only leader tracks this
}

export interface UsePerformanceSessionResult {
  mode: PerformRole;
  currentIndex: number;
  chartIds: string[];
  sessionName: string;
  leaderName: string | null;
  followerCount: number;
  isFollowing: boolean;
  goTo: (index: number) => void;
  endSession: () => void;
  stopFollowing: () => void;
  resumeFollowing: () => void;
}

/**
 * Manages an ephemeral Supabase Realtime performance session on
 * channel `session-{code}`.
 *
 * @param code            6-char session code
 * @param initialPayload  Pass for the leader device only.
 *                        If undefined, this device joins as a follower.
 */
export function usePerformanceSession(
  code: string,
  initialPayload?: { chartIds: string[]; sessionName: string },
): UsePerformanceSessionResult {
  const isLeader = !!initialPayload;

  const [mode, setMode] = useState<PerformRole>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chartIds, setChartIds] = useState<string[]>(initialPayload?.chartIds ?? []);
  const [sessionName, setSessionName] = useState(initialPayload?.sessionName ?? '');
  const [leaderName, setLeaderName] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(true);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myNameRef = useRef('Anonymous');
  const myEmailRef = useRef<string | null>(null);
  const currentIndexRef = useRef(0);
  const isFollowingRef = useRef(true);
  const isMountedRef = useRef(true);

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { isFollowingRef.current = isFollowing; }, [isFollowing]);

  useEffect(() => {
    isMountedRef.current = true;
    // Unique suffix per mount prevents "cannot add presence callbacks after subscribe()"
    // which occurs under React Strict Mode's double-invoke of effects.
    const instanceId = Math.random().toString(36).slice(2, 8);
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMountedRef.current) return;
      if (user) {
        myEmailRef.current = user.email ?? null;
        myNameRef.current = user.email?.split('@')[0] ?? 'Anonymous';
      }

      const channel = supabase.channel(`session-${code}-${instanceId}`);
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'chart-change' }, ({ payload }) => {
          if (!isMountedRef.current) return;
          const idx = payload?.index ?? 0;
          setCurrentIndex(idx);
          currentIndexRef.current = idx;
          if (isFollowingRef.current) {
            window.dispatchEvent(new CustomEvent('perform-navigate', { detail: { index: idx } }));
          }
        })
        .on('broadcast', { event: 'session-end' }, () => {
          if (!isMountedRef.current) return;
          setMode('loading');
          window.dispatchEvent(new CustomEvent('perform-session-end'));
        })
        .on('presence', { event: 'sync' }, () => {
          if (!isMountedRef.current) return;
          const state = channel.presenceState<PerformancePresence>();
          const presences = Object.values(state).flat() as PerformancePresence[];

          const leader = presences.find(p => p.role === 'leader');
          setLeaderName(leader?.name ?? null);

          if (!isLeader && leader) {
            if (leader.chartIds && leader.chartIds.length > 0) {
              setChartIds(leader.chartIds);
            }
            if (leader.sessionName) {
              setSessionName(leader.sessionName);
            }
            setCurrentIndex(leader.currentIndex ?? 0);
            currentIndexRef.current = leader.currentIndex ?? 0;
            setMode('follower');
          }

          const followers = presences.filter(p => p.role === 'follower');
          setFollowerCount(followers.length);
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED') return;
          if (!isMountedRef.current) return;

          if (isLeader) {
            await channel.track({
              role: 'leader',
              name: myNameRef.current,
              currentIndex: 0,
              chartIds: initialPayload!.chartIds,
              sessionName: initialPayload!.sessionName,
            });
            setMode('leader');
          } else {
            await channel.track({
              role: 'follower',
              name: myNameRef.current,
              currentIndex: 0,
            });
          }
        });
    };

    init();

    return () => {
      isMountedRef.current = false;
      const ch = channelRef.current;
      if (ch) {
        supabase.removeChannel(ch);
      }
    };
  }, [code, isLeader]);

  // ── Leader actions ────────────────────────────────────────────────────────

  const goTo = useCallback((index: number) => {
    const ch = channelRef.current;
    if (!ch) return;
    setCurrentIndex(index);
    currentIndexRef.current = index;
    // Update own presence so late-joiners see the right index
    ch.track({
      role: 'leader',
      name: myNameRef.current,
      currentIndex: index,
      chartIds: initialPayload?.chartIds,
      sessionName: initialPayload?.sessionName,
    });
    ch.send({ type: 'broadcast', event: 'chart-change', payload: { index } });
  }, [initialPayload]);

  const endSession = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: 'broadcast', event: 'session-end', payload: {} });
    supabase.removeChannel(ch);
    channelRef.current = null;
  }, []);

  // ── Follower actions ──────────────────────────────────────────────────────

  const stopFollowing = useCallback(() => {
    setIsFollowing(false);
    isFollowingRef.current = false;
  }, []);

  const resumeFollowing = useCallback(() => {
    setIsFollowing(true);
    isFollowingRef.current = true;
    // Jump to current leader position
    window.dispatchEvent(new CustomEvent('perform-navigate', { detail: { index: currentIndexRef.current } }));
  }, []);

  return {
    mode,
    currentIndex,
    chartIds,
    sessionName,
    leaderName,
    followerCount,
    isFollowing,
    goTo,
    endSession,
    stopFollowing,
    resumeFollowing,
  };
}
