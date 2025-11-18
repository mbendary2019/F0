'use client';

import { useEffect, useState } from 'react';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getIdToken } from 'firebase/auth';
import Link from 'next/link';
import { app } from '@/lib/firebase';

// Dev-only page - hide in production
if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
  window.location.href = '/';
}

export default function DevAuthPage() {
  const [user, setUser] = useState<any>(null);
  const [claims, setClaims] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const token = await getIdToken(currentUser);
        const tokenResult = await currentUser.getIdTokenResult();
        setClaims(tokenResult.claims);
      } else {
        setClaims(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function doSignIn() {
    try {
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      
      // بعد منح admin claim، جدّد التوكن بالقوة ليجلب الـ claims
      const currentUser = auth.currentUser;
      if (currentUser) {
        await getIdToken(currentUser, true);
        const tokenResult = await currentUser.getIdTokenResult();
        setClaims(tokenResult.claims);
      }
      
      alert('✅ Signed in successfully! Token refreshed.');
    } catch (error: any) {
      alert(`❌ Sign in failed: ${error.message}`);
      console.error('Sign in error:', error);
    }
  }

  async function doSignOut() {
    try {
      const auth = getAuth(app);
      await signOut(auth);
      setUser(null);
      setClaims(null);
      alert('✅ Signed out successfully.');
    } catch (error: any) {
      alert(`❌ Sign out failed: ${error.message}`);
      console.error('Sign out error:', error);
    }
  }

  async function refreshClaims() {
    try {
      const auth = getAuth(app);
      const currentUser = auth.currentUser;
      if (currentUser) {
        await getIdToken(currentUser, true);
        const tokenResult = await currentUser.getIdTokenResult();
        setClaims(tokenResult.claims);
        alert('✅ Claims refreshed! الآن افتح /audits');
      } else {
        alert('⚠️ Not signed in');
      }
    } catch (error: any) {
      alert(`❌ Refresh failed: ${error.message}`);
      console.error('Refresh claims error:', error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading auth state...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            🔐 Dev Auth
          </h1>
          <p className="text-neutral-400">
            Development authentication & admin claims testing
          </p>
        </div>

        {/* User Status */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-cyan-400">User Status</h2>
          
          {user ? (
            <div className="space-y-3">
              <div>
                <span className="text-neutral-500 font-medium">Email:</span>{' '}
                <span className="text-white">{user.email}</span>
              </div>
              <div>
                <span className="text-neutral-500 font-medium">UID:</span>{' '}
                <span className="text-xs text-neutral-400 font-mono">{user.uid}</span>
              </div>
              <div>
                <span className="text-neutral-500 font-medium">Display Name:</span>{' '}
                <span className="text-white">{user.displayName || 'N/A'}</span>
              </div>
              <div>
                <span className="text-neutral-500 font-medium">Email Verified:</span>{' '}
                <span className={user.emailVerified ? "text-green-400" : "text-yellow-400"}>
                  {user.emailVerified ? '✅ Yes' : '⚠️ No'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-neutral-500">❌ Not signed in</p>
          )}
        </div>

        {/* Custom Claims */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-cyan-400">Custom Claims</h2>
          
          {claims ? (
            <div className="space-y-3">
              <div>
                <span className="text-neutral-500 font-medium">Admin:</span>{' '}
                <span className={claims.admin ? "text-green-400 font-bold" : "text-red-400"}>
                  {claims.admin ? '✅ TRUE' : '❌ FALSE'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 font-medium">Role:</span>{' '}
                <span className="text-white">{claims.role || 'None'}</span>
              </div>
              <details className="mt-4">
                <summary className="text-neutral-400 cursor-pointer hover:text-cyan-400">
                  View All Claims (JSON)
                </summary>
                <pre className="mt-2 bg-black border border-neutral-700 rounded p-4 text-xs overflow-auto text-neutral-300">
                  {JSON.stringify(claims, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <p className="text-neutral-500">No claims available (not signed in)</p>
          )}
        </div>

        {/* Actions */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-cyan-400">Actions</h2>
          
          <div className="flex flex-wrap gap-3">
            {!user ? (
              <button
                onClick={doSignIn}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-cyan-500/50"
              >
                🔐 Sign in with Google
              </button>
            ) : (
              <>
                <button
                  onClick={doSignOut}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-200"
                >
                  🚪 Sign Out
                </button>
                <button
                  onClick={refreshClaims}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all duration-200"
                >
                  🔄 Refresh Claims
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-cyan-400">Navigation</h2>
          
          <div className="space-y-2">
            <Link
              href="/audits"
              className="block px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-white"
            >
              📊 Audit Dashboard → <span className="text-cyan-400">/audits</span>
            </Link>
            <Link
              href="/tasks"
              className="block px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-white"
            >
              📋 Tasks Dashboard → <span className="text-cyan-400">/tasks</span>
            </Link>
            <Link
              href="/pricing"
              className="block px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-white"
            >
              💰 Pricing Page → <span className="text-cyan-400">/pricing</span>
            </Link>
            <Link
              href="/"
              className="block px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-white"
            >
              🏠 Home → <span className="text-cyan-400">/</span>
            </Link>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-800/50 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-cyan-400">📚 Instructions</h2>
          
          <div className="space-y-4 text-neutral-300">
            <div>
              <h3 className="font-semibold text-white mb-2">1. Sign In</h3>
              <p className="text-sm">Click "Sign in with Google" to authenticate using your Google account.</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-white mb-2">2. Grant Admin Access</h3>
              <p className="text-sm">If you haven't granted admin access yet, run:</p>
              <pre className="mt-2 bg-black border border-neutral-700 rounded p-3 text-xs overflow-auto">
                node scripts/grantAdmin.js {user?.uid || 'YOUR_UID'}
              </pre>
            </div>
            
            <div>
              <h3 className="font-semibold text-white mb-2">3. Refresh Claims</h3>
              <p className="text-sm">After granting admin access, click "Refresh Claims" to reload your custom claims without signing out.</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-white mb-2">4. Access Dashboard</h3>
              <p className="text-sm">Once you see "Admin: ✅ TRUE", you can access the audit dashboard at <Link href="/audits" className="text-cyan-400 hover:underline">/audits</Link></p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-neutral-500 text-sm">
          <p>Phase 35 & 36 - Dev Auth Page</p>
          <p className="mt-1">🔐 Development Only - Do not use in production</p>
        </div>
      </div>
    </div>
  );
}

