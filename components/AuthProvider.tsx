'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { syncAllOffline } from '@/lib/storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  enableGuestMode: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  isGuest: false, 
  enableGuestMode: () => {},
  signOut: async () => {} 
});

const GUEST_KEY = 'chord-grid-guest-mode';
const OFFLINE_USER_KEY = 'chord-grid-offline-user-id';

function getOrCreateOfflineUser(): User {
  let offlineId = typeof window !== 'undefined' ? localStorage.getItem(OFFLINE_USER_KEY) : null;
  if (!offlineId) {
    offlineId = 'offline-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
    if (typeof window !== 'undefined') {
      localStorage.setItem(OFFLINE_USER_KEY, offlineId);
    }
  }
  return {
    id: offlineId,
    email: 'guest@offline.local',
    app_metadata: {},
    user_metadata: { name: 'Offline Guest' },
    aud: 'authenticated',
    created_at: new Date().toISOString()
  } as User;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const enableGuestMode = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(GUEST_KEY, 'true');
    }
    setIsGuest(true);
    setUser(getOrCreateOfflineUser());
  };

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(GUEST_KEY);
      localStorage.removeItem(OFFLINE_USER_KEY);
    }
    setIsGuest(false);
    setUser(null);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Auth] SignOut error:', err);
    }
    router.push('/auth');
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const guestPref = typeof window !== 'undefined' && localStorage.getItem(GUEST_KEY) === 'true';

        if (guestPref) {
          setIsGuest(true);
          setUser(getOrCreateOfflineUser());
          setLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setIsGuest(false);
          // Pre-cache all user songs in background for offline use
          syncAllOffline().catch(() => {});
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn('[Auth] Error fetching session, enabling offline fallback:', err);
        setIsGuest(true);
        setUser(getOrCreateOfflineUser());
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
          setIsGuest(false);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(GUEST_KEY);
          }
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading && !user && pathname !== '/auth') {
      router.push('/auth');
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, enableGuestMode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

