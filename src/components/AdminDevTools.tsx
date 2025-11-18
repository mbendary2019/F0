'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebaseClient';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export function AdminDevTools() {
  const [user, setUser] = useState<any>(null);
  const [claims, setClaims] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        const tokenResult = await currentUser.getIdTokenResult();
        setClaims(tokenResult.claims);
        setIsAdmin(tokenResult.claims.admin === true);
      } else {
        setClaims(null);
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleRefreshClaims = async () => {
    if (!user) return;

    try {
      await user.getIdToken(true); // Force refresh
      const tokenResult = await user.getIdTokenResult();
      setClaims(tokenResult.claims);
      setIsAdmin(tokenResult.claims.admin === true);
      alert('✅ Claims refreshed! You may need to reload the page.');
    } catch (error) {
      console.error('Refresh claims error:', error);
      alert('❌ Failed to refresh claims');
    }
  };

  // Only show to admin users or in development
  if (!isAdmin && process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (loading) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-2 shadow-lg border-t-2 border-yellow-500 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="font-bold text-yellow-400">🔧 DEV TOOLS</span>

          {user ? (
            <>
              <span className="text-gray-300">
                {user.email || 'Anonymous'}
                {isAdmin && <span className="ml-2 text-green-400">(Admin)</span>}
              </span>

              <span className="text-gray-400">UID: {user.uid.slice(0, 8)}...</span>
            </>
          ) : (
            <span className="text-red-400">Not signed in</span>
          )}

          {claims && (
            <span className="text-gray-400">
              Claims: {Object.keys(claims).filter((k) => !k.startsWith('firebase')).length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <>
              <button
                onClick={handleRefreshClaims}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium"
              >
                Refresh Claims
              </button>

              <button
                onClick={handleSignOut}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium"
              >
                Sign Out
              </button>
            </>
          )}

          <a
            href="/admin/diagnostics"
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium"
          >
            Diagnostics
          </a>

          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
