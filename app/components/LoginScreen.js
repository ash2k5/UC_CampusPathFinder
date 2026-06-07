'use client';

import { useState } from 'react';
import { Map as MapIcon, Loader2 } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts — try again later.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/email-already-in-use': 'An account with that email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
};

export default function LoginScreen() {
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const fallback = authMode === 'login' ? 'Login failed. Check your credentials.' : `Sign up failed: ${err.code}`;
      setError(AUTH_ERRORS[err.code] || fallback);
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-linear-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow"><MapIcon size={22} /></div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight">UC CampusPathFinder</h1>
            <p className="text-xs text-slate-400">Sign in to continue</p>
          </div>
        </div>

        <div className="flex bg-slate-100 rounded-2xl p-1 mb-5">
          <button
            onClick={() => { setAuthMode('login'); setError(''); }}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${authMode === 'login' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
          >Sign In</button>
          <button
            onClick={() => { setAuthMode('signup'); setError(''); }}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${authMode === 'signup' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
          >Create Account</button>
        </div>

        <form onSubmit={submit} className="space-y-3 mb-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            required
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-200 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={authMode === 'signup' ? 'Password (min 6 characters)' : 'Password'}
            aria-label="Password"
            required
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-200 text-sm"
          />
          {error && <p role="alert" className="text-xs text-red-500 font-semibold px-1">{error}</p>}
          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            {isLoggingIn && <Loader2 size={16} className="animate-spin" />}
            {isLoggingIn ? (authMode === 'login' ? 'Signing in...' : 'Creating account...') : (authMode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}
