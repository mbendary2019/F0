'use client';

/**
 * AuthGate Provider
 * مزوّد لمراقبة حالة المصادقة عالمياً
 */

import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isSignedIn: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isSignedIn: false,
});

/**
 * Hook للوصول لحالة المصادقة
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthGate');
  }
  return context;
}

interface AuthGateProps {
  children: ReactNode;
  /**
   * عرض loader أثناء التحقق من الجلسة
   */
  showLoader?: boolean;
  /**
   * مكون مخصص للـ loader
   */
  loader?: ReactNode;
}

/**
 * AuthGate - مزوّد لمراقبة حالة المصادقة
 */
export default function AuthGate({
  children,
  showLoader = true,
  loader,
}: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // الاستماع لتغييرات حالة المصادقة
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);

        // تسجيل للتتبع
        if (currentUser) {
          console.log('[AuthGate] User signed in:', currentUser.uid);
        } else {
          console.log('[AuthGate] User signed out');
        }
      },
      (error) => {
        console.error('[AuthGate] Auth state change error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    isSignedIn: !!user,
  };

  // عرض loader أثناء التحقق
  if (loading && showLoader) {
    return (
      <>
        {loader || (
          <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
              <div className="text-white/60 text-sm">
                Checking authentication...
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/**
 * Higher-order component لحماية الصفحات
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    redirectTo?: string;
    requireAuth?: boolean;
  }
) {
  return function AuthenticatedComponent(props: P) {
    const { user, loading } = useAuth();
    const redirectTo = options?.redirectTo || '/auth';
    const requireAuth = options?.requireAuth ?? true;

    useEffect(() => {
      if (!loading && requireAuth && !user) {
        window.location.href = redirectTo;
      }
    }, [user, loading]);

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white/60">Loading...</div>
        </div>
      );
    }

    if (requireAuth && !user) {
      return null;
    }

    return <Component {...props} />;
  };
}
