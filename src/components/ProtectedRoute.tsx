"use client";
import { useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({
  children,
  redirectTo = "/login",
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // User is null (not authenticated) - redirect to login
    if (!loading && user === null) {
      const currentPath = window.location.pathname;
      router.replace(`${redirectTo}?next=${encodeURIComponent(currentPath)}`);
    }
  }, [user, loading, router, redirectTo]);

  // Loading state during SSR or initial auth check
  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - return null (will redirect via useEffect)
  if (user === null) {
    return null;
  }

  // Check admin requirement if needed
  if (requireAdmin) {
    // This would need to check custom claims
    // For now, we'll skip this check
  }

  // User is authenticated - render children
  return <>{children}</>;
}
