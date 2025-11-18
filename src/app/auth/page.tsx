'use client';

/**
 * Authentication Page
 * صفحة تسجيل الدخول عبر Apple
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { auth } from '@/lib/firebase';
import {
  handleAppleRedirect,
  signInWithAppleAuto,
} from '@/lib/appleProvider';
import type { User } from 'firebase/auth';
import SignInWithPasskey from '@/components/passkeys/SignInWithPasskey';
import ConditionalPasskeyUI from '@/components/passkeys/ConditionalPasskeyUI';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  // التحقق من redirect نتيجة عند تحميل الصفحة
  useEffect(() => {
    (async () => {
      try {
        const credential = await handleAppleRedirect(auth);
        if (credential) {
          setUser(credential.user);
          console.log('User signed in via redirect:', credential.user.uid);
        }
      } catch (err: any) {
        console.error('Redirect handling error:', err);
        setError(err.message || 'Failed to handle redirect');
      } finally {
        setChecking(false);
      }
    })();

    // الاستماع لتغييرات حالة المصادقة
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setChecking(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAppleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      const credential = await signInWithAppleAuto(auth);

      if (credential) {
        // Popup flow - المستخدم سجل دخول مباشرة
        setUser(credential.user);
        console.log('User signed in via popup:', credential.user.uid);
      } else {
        // Redirect flow - سيتم توجيه المستخدم لـ Apple
        console.log('Redirecting to Apple Sign-In...');
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setError(err.message || 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setError(null);
    } catch (err: any) {
      console.error('Sign-out error:', err);
      setError(err.message || 'Sign-out failed');
    }
  };

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="text-white/60">Checking authentication...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome to F0 Agent
            </h1>
            <p className="text-white/60 text-sm">
              Sign in to continue to your AI workspace
            </p>
          </div>

          {/* User Info or Sign-In Button */}
          {user ? (
            <div className="space-y-6">
              {/* User Card */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {user.displayName?.[0] ||
                      user.email?.[0] ||
                      'U'}
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      {user.displayName || 'Apple User'}
                    </div>
                    <div className="text-white/60 text-sm">
                      {user.email || user.uid}
                    </div>
                  </div>
                </div>

                {/* User Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/40">User ID:</span>
                    <span className="text-white/80 font-mono text-xs">
                      {user.uid.slice(0, 12)}...
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Provider:</span>
                    <span className="text-white/80">Apple</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Verified:</span>
                    <span className="text-green-400">
                      ✓ {user.emailVerified ? 'Yes' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <a
                  href="/dashboard"
                  className="block w-full text-center px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 transition"
                >
                  Go to Dashboard →
                </a>
                <button
                  onClick={handleSignOut}
                  className="w-full px-6 py-3 rounded-xl border border-white/20 text-white/80 hover:bg-white/5 transition"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Conditional Passkey UI (Autofill) */}
              <ConditionalPasskeyUI
                onSuccess={() => setUser(auth.currentUser)}
                onError={(err) => setError(err)}
              />

              {/* Passkey Sign-In Button */}
              <div className="space-y-3">
                <SignInWithPasskey onSuccess={() => setUser(auth.currentUser)} />
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-black/40 text-white/40">
                    or continue with
                  </span>
                </div>
              </div>

              {/* Apple Sign-In Button */}
              <button
                onClick={handleAppleSignIn}
                disabled={loading}
                className="group w-full inline-flex items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-white hover:bg-white/10 hover:border-white/30 active:scale-[.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Sign in with Apple"
              >
                <Image
                  src="/apple-logo.svg"
                  alt="Apple"
                  width={20}
                  height={20}
                  className="opacity-90"
                />
                <span className="font-semibold">
                  {loading ? 'Connecting...' : 'Sign in with Apple'}
                </span>
              </button>

              {/* Features */}
              <div className="space-y-3 text-sm text-white/60">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-green-400"></div>
                  <span>Privacy-first authentication</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-blue-400"></div>
                  <span>No password required</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-purple-400"></div>
                  <span>Secure with biometrics</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <div className="font-semibold mb-1">⚠️ Authentication Error</div>
              <div className="opacity-90">{error}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-white/40 text-xs">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </div>
      </div>
    </main>
  );
}
