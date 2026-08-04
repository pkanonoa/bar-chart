'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Eye, EyeOff, User, Mail, Lock, CheckCircle2 } from 'lucide-react';

export default function AuthPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState(''); // for Sign In (username or email)
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        // --- SIGN UP FLOW ---
        const cleanUsername = username.trim().toLowerCase();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanUsername) {
          setError('Please choose a username.');
          setIsSubmitting(false);
          return;
        }

        if (!cleanEmail || !cleanEmail.includes('@')) {
          setError('Please enter a valid email address for verification.');
          setIsSubmitting(false);
          return;
        }

        // Store local username to email mapping for fast username login
        if (typeof window !== 'undefined') {
          localStorage.setItem(`cc_user_${cleanUsername}`, cleanEmail);
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              username: cleanUsername,
            }
          }
        });

        if (error) throw error;

        setSuccessMessage(`Account created! A verification link has been sent to ${cleanEmail}. Please check your email to verify.`);
      } else {
        // --- SIGN IN FLOW ---
        const cleanIdentifier = identifier.trim().toLowerCase();
        if (!cleanIdentifier) {
          setError('Please enter your username or email address.');
          setIsSubmitting(false);
          return;
        }

        let targetEmail = cleanIdentifier;

        // If the user typed a username (no @ symbol)
        if (!cleanIdentifier.includes('@')) {
          const cachedEmail = typeof window !== 'undefined' ? localStorage.getItem(`cc_user_${cleanIdentifier}`) : null;
          if (cachedEmail) {
            targetEmail = cachedEmail;
          } else {
            // Fallback for simple usernames created without full email
            targetEmail = `${cleanIdentifier}@chordcraft.app`;
          }
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password
        });

        if (error) throw error;
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-gray-900 p-8 shadow-popover border border-gray-800">
        <div className="flex justify-center mb-4">
          <div className="bg-accent-solid p-1 rounded-2xl shadow-popover overflow-hidden flex items-center justify-center">
            <img src="/icon.jpg" alt="ChordCraft Logo" className="w-16 h-16 object-cover rounded-xl" />
          </div>
        </div>
        
        <h2 className="mb-1 text-center text-2xl font-bold text-white tracking-tight">
          {isSignUp ? 'Create an Account' : 'Welcome to ChordCraft'}
        </h2>
        <p className="mb-6 text-center text-xs text-gray-400">
          {isSignUp ? 'Choose a username and verify with your email' : 'Sign in using your username or email'}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp ? (
            <>
              {/* Username Input for Signup */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. donythomas"
                    className="block w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-500 shadow-sm focus:border-accent-solid focus:outline-none text-sm transition-all"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              {/* Real Email Input for Signup (Valid Email Verification) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1">
                  Email Address (For Verification)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="e.g. donythomas098@gmail.com"
                    className="block w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-500 shadow-sm focus:border-accent-solid focus:outline-none text-sm transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            /* Username or Email Input for Sign In */
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. donythomas or email@gmail.com"
                  className="block w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-500 shadow-sm focus:border-accent-solid focus:outline-none text-sm transition-all"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Password Input with Eye Toggle */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                className="block w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-500 shadow-sm focus:border-accent-solid focus:outline-none text-sm transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-400 font-medium flex items-start space-x-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-accent-gradient font-bold text-sm text-white shadow-md hover:brightness-110 focus:outline-none transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center space-y-3">
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccessMessage(null); }}
            className="text-xs font-bold text-accent-start hover:underline transition-all"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
          
          <div className="w-full flex items-center my-2">
            <div className="flex-1 border-t border-gray-800" />
            <span className="px-2 text-[10px] text-gray-500 uppercase tracking-widest">Or</span>
            <div className="flex-1 border-t border-gray-800" />
          </div>

          <button
            onClick={handleGuestClick}
            className="w-full py-2.5 px-4 bg-gray-800 border border-gray-700 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-700 transition-all flex items-center justify-center"
          >
            ⚡ Continue Offline (Guest Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
