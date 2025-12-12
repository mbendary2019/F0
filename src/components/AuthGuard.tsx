// src/components/AuthGuard.tsx
// Phase 122.6: AuthGuard component for protecting pages
// Requires Firebase Auth - redirects or shows UI for unauthenticated users

'use client';

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';

interface AuthGuardProps {
  children: React.ReactNode;
  /** Redirect to this path if not authenticated (default: show message) */
  redirectTo?: string;
  /** Custom loading component */
  loadingComponent?: React.ReactNode;
  /** Custom unauthorized component */
  unauthorizedComponent?: React.ReactNode;
  /** Locale for messages */
  locale?: 'ar' | 'en';
}

/**
 * AuthGuard - Protects pages from unauthenticated access
 *
 * Usage:
 * ```tsx
 * export default function ProtectedPage() {
 *   return (
 *     <AuthGuard>
 *       <YourPageContent />
 *     </AuthGuard>
 *   );
 * }
 * ```
 *
 * With redirect:
 * ```tsx
 * <AuthGuard redirectTo="/login">
 *   <YourPageContent />
 * </AuthGuard>
 * ```
 */
export default function AuthGuard({
  children,
  redirectTo,
  loadingComponent,
  unauthorizedComponent,
  locale = 'ar',
}: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);

      // Redirect if specified and user is not authenticated
      if (!u && redirectTo) {
        router.push(redirectTo);
      }
    });

    return () => unsubscribe();
  }, [redirectTo, router]);

  // Loading state
  if (loading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }

    return (
      <div className="w-full h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-white/70 text-sm">
            {locale === 'ar' ? 'جاري التحقق من الهوية...' : 'Checking authentication...'}
          </span>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    // If redirectTo is set, we're already redirecting
    if (redirectTo) {
      return (
        <div className="w-full h-screen flex items-center justify-center bg-zinc-950">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white/70 text-sm">
              {locale === 'ar' ? 'جاري التحويل...' : 'Redirecting...'}
            </span>
          </div>
        </div>
      );
    }

    if (unauthorizedComponent) {
      return <>{unauthorizedComponent}</>;
    }

    return (
      <div className="w-full h-screen flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-zinc-900 border border-zinc-800 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-7a2 2 0 100-4 2 2 0 000 4zm0 0v3m0 0a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4h10a4 4 0 014 4v3a4 4 0 01-4 4h-1"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">
            {locale === 'ar' ? 'يجب تسجيل الدخول' : 'Authentication Required'}
          </h2>
          <p className="text-zinc-400">
            {locale === 'ar'
              ? 'يجب عليك تسجيل الدخول لعرض هذه الصفحة.'
              : 'You must be logged in to view this page.'}
          </p>
          <button
            onClick={() => router.push('/auth')}
            className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            {locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
          </button>
        </div>
      </div>
    );
  }

  // Authenticated - render children
  return <>{children}</>;
}

/**
 * Higher-order component version of AuthGuard
 *
 * Usage:
 * ```tsx
 * export default withAuthGuard(YourComponent);
 * ```
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardProps?: Omit<AuthGuardProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <AuthGuard {...guardProps}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}
