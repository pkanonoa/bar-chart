'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/components/AuthProvider';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user, loading, enableGuestMode } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading...</div>;
  if (user) {
    router.push('/');
    return null;
  }

  const handleGuestClick = () => {
    enableGuestMode();
    router.push('/');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-gray-900 p-8 shadow-lg ring-1 ring-white/10">
        <div className="flex justify-center mb-4">
          <div className="bg-accent-solid p-1 rounded-2xl shadow-popover overflow-hidden flex items-center justify-center">
            <img src="/icon.jpg" alt="ChordCraft Logo" className="w-16 h-16 object-cover rounded-xl" />
          </div>
        </div>
        <h2 className="mb-6 text-center text-2xl font-bold text-white tracking-tight">
          {isSignUp ? 'Create an Account' : 'Welcome to ChordCraft'}
        </h2>
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Email</label>
            <input
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Password</label>
            <input
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
          >
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>
        <div className="mt-6 flex flex-col items-center space-y-3">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
          
          <div className="w-full flex items-center my-2">
            <div className="flex-1 border-t border-gray-800" />
            <span className="px-2 text-xs text-gray-500 uppercase">Or</span>
            <div className="flex-1 border-t border-gray-800" />
          </div>

          <button
            onClick={handleGuestClick}
            className="w-full py-2 px-4 bg-gray-800 border border-gray-700 rounded-md text-sm font-bold text-gray-300 hover:text-white hover:bg-gray-700 transition-all flex items-center justify-center"
          >
            ⚡ Continue Offline (Guest Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
