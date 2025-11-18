/**
 * Phase 47 - Organization RBAC Guard
 * Protect pages requiring specific roles
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from './useOrg';

type Role = 'owner' | 'admin' | 'member' | 'viewer';

interface UseOrgGuardOptions {
  /** Required role (user must have this role or higher) */
  requiredRole?: Role;
  /** Redirect path if access denied */
  redirectTo?: string;
  /** Whether to show loading state */
  loading?: boolean;
}

const roleHierarchy: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Hook to protect pages with RBAC
 * @example
 * ```tsx
 * export default function AdminPage() {
 *   const { loading, hasAccess } = useOrgGuard({ requiredRole: 'admin' });
 *   if (loading) return <div>Loading...</div>;
 *   if (!hasAccess) return null; // Will redirect
 *   return <div>Admin content</div>;
 * }
 * ```
 */
export function useOrgGuard(options: UseOrgGuardOptions = {}) {
  const {
    requiredRole,
    redirectTo = '/org',
    loading: externalLoading = false,
  } = options;

  const router = useRouter();
  const { orgId, currentRole } = useOrg();

  const hasAccess =
    !requiredRole ||
    !currentRole ||
    roleHierarchy[currentRole] >= roleHierarchy[requiredRole];

  const loading = externalLoading || !orgId;

  useEffect(() => {
    // Only redirect if we have an orgId and role but no access
    if (!loading && orgId && currentRole && !hasAccess) {
      router.push(redirectTo);
    }
  }, [loading, orgId, currentRole, hasAccess, redirectTo, router]);

  return {
    loading,
    hasAccess,
    currentRole,
    orgId,
  };
}

/**
 * Check if user has permission for an action
 */
export function hasPermission(
  userRole: Role | null,
  requiredRole: Role
): boolean {
  if (!userRole) return false;
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
