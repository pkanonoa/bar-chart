'use client';

import React from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { User, Mail, CreditCard, LogOut, CornerLeftUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-white">Loading...</div>;
  }

  if (!user) {
    router.push('/auth');
    return null;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto w-full px-4 pt-[max(env(safe-area-inset-top,2rem),2rem)] pb-32">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center mb-10 space-x-4">
          <button
            onClick={() => router.push('/')}
            className="p-3 text-text-secondary bg-surface border border-border rounded-xl hover:text-white hover:bg-surface-raised transition-all"
            title="Back"
          >
            <CornerLeftUp size={20} />
          </button>
          <div className="w-12 h-12 bg-surface-raised rounded-xl flex items-center justify-center shadow-inner border border-border">
            <User size={24} className="text-accent-start" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        </div>

        <div className="bg-surface border border-border rounded-3xl p-8 shadow-card space-y-10">
          
          <div className="flex items-center space-x-6">
            <div className="w-20 h-20 bg-accent-gradient rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-md">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{user.email}</h2>
              <div className="inline-flex items-center px-3 py-1 bg-surface-raised border border-border rounded-full text-xs font-bold tracking-widest uppercase text-accent-start">
                Free Plan
              </div>
            </div>
          </div>

          <div className="h-px bg-border w-full"></div>

          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary">Account Details</h3>
            
            <div className="grid gap-4">
              <div className="flex items-center p-4 bg-surface-raised border border-border rounded-2xl">
                <Mail size={20} className="text-text-secondary mr-4" />
                <div>
                  <p className="text-xs text-text-secondary uppercase tracking-wider font-bold mb-1">Email Address</p>
                  <p className="font-medium text-white">{user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-surface-raised border border-border rounded-2xl">
                <div className="flex items-center">
                  <CreditCard size={20} className="text-text-secondary mr-4" />
                  <div>
                    <p className="text-xs text-text-secondary uppercase tracking-wider font-bold mb-1">Subscription</p>
                    <p className="font-medium text-white">Free Tier</p>
                  </div>
                </div>
                <button className="px-4 py-2 bg-accent-gradient rounded-xl text-white text-xs font-bold uppercase tracking-widest shadow-md hover:brightness-110 transition-all">
                  Upgrade
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 font-bold tracking-widest uppercase hover:bg-red-500/20 hover:text-red-300 transition-all"
            >
              <LogOut size={18} className="mr-3" /> Log Out
            </button>
          </div>

        </div>
      </div>
      </main>
    </div>
  );
}
