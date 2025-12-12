// desktop/src/lib/agent/tools/opsPermissionsPlanner.ts
// Phase 124.3: Ops Permissions Planner for Smart Route-Aware Agent
// Plans permissions and access controls for /ops routes

import type { IndexedRoute, RoutesIndex } from '../../../../indexer/types';

/**
 * Permission level for ops routes
 */
export type PermissionLevel = 'public' | 'authenticated' | 'admin' | 'superadmin';

/**
 * Permission requirement for a route
 */
export interface RoutePermission {
  route: IndexedRoute;
  requiredLevel: PermissionLevel;
  reason: string;
  suggestedMiddleware?: string;
  suggestedGuard?: string;
}

/**
 * Ops permissions plan result
 */
export interface OpsPermissionsPlan {
  success: boolean;
  totalOpsRoutes: number;
  permissions: RoutePermission[];
  summary: {
    public: number;
    authenticated: number;
    admin: number;
    superadmin: number;
  };
  recommendations: string[];
}

/**
 * Route permission patterns
 * Maps route patterns to required permission levels
 */
const PERMISSION_PATTERNS: Array<{
  pattern: RegExp;
  level: PermissionLevel;
  reason: string;
}> = [
  // Super admin routes
  {
    pattern: /\/(superadmin|sa-only|master)/i,
    level: 'superadmin',
    reason: 'Contains superadmin segment',
  },
  {
    pattern: /\/(users\/delete|data\/purge|system\/reset)/i,
    level: 'superadmin',
    reason: 'Destructive operation',
  },

  // Admin routes
  {
    pattern: /\/ops\/(admin|manage|config|settings)/i,
    level: 'admin',
    reason: 'Administrative function',
  },
  {
    pattern: /\/ops\/(users|members|roles)/i,
    level: 'admin',
    reason: 'User management',
  },
  {
    pattern: /\/ops\/(billing|payments|subscriptions)/i,
    level: 'admin',
    reason: 'Financial data',
  },
  {
    pattern: /\/ops\/(audit|logs|analytics)/i,
    level: 'admin',
    reason: 'Sensitive data access',
  },
  {
    pattern: /\/ops\/(deploy|release|publish)/i,
    level: 'admin',
    reason: 'Deployment control',
  },

  // Authenticated routes
  {
    pattern: /\/ops\/(dashboard|overview|stats)/i,
    level: 'authenticated',
    reason: 'General ops view',
  },
  {
    pattern: /\/ops\/(timeline|history|activity)/i,
    level: 'authenticated',
    reason: 'Activity tracking',
  },
  {
    pattern: /\/ops\/(projects|tasks|queue)/i,
    level: 'authenticated',
    reason: 'Project operations',
  },

  // Default ops route
  {
    pattern: /\/ops/i,
    level: 'authenticated',
    reason: 'Default ops route',
  },
];

/**
 * Suggested middleware/guards by permission level
 */
const MIDDLEWARE_SUGGESTIONS: Record<PermissionLevel, { middleware: string; guard: string }> = {
  public: {
    middleware: 'none',
    guard: 'none',
  },
  authenticated: {
    middleware: 'withAuth',
    guard: 'useRequireAuth()',
  },
  admin: {
    middleware: 'withAdminAuth',
    guard: 'useRequireAdmin()',
  },
  superadmin: {
    middleware: 'withSuperAdminAuth',
    guard: 'useRequireSuperAdmin()',
  },
};

/**
 * Determine permission level for a route
 */
function determinePermissionLevel(route: IndexedRoute): {
  level: PermissionLevel;
  reason: string;
} {
  const path = route.urlPath.toLowerCase();

  // Check against patterns
  for (const { pattern, level, reason } of PERMISSION_PATTERNS) {
    if (pattern.test(path)) {
      return { level, reason };
    }
  }

  // Default based on route type
  if (route.kind === 'api') {
    return {
      level: 'authenticated',
      reason: 'API endpoint (default)',
    };
  }

  return {
    level: 'authenticated',
    reason: 'Page route (default)',
  };
}

/**
 * Get all ops routes from index
 */
function getOpsRoutes(routesIndex: RoutesIndex): IndexedRoute[] {
  return routesIndex.routes.filter(r =>
    r.urlPath.toLowerCase().includes('/ops') ||
    r.fsPath.toLowerCase().includes('/ops/')
  );
}

/**
 * Plan permissions for all ops routes
 *
 * Usage:
 * ```typescript
 * const plan = planOpsPermissions(routesIndex);
 * console.log(plan.recommendations);
 * ```
 */
export function planOpsPermissions(routesIndex: RoutesIndex): OpsPermissionsPlan {
  console.log('[opsPermissionsPlanner] Planning permissions...');

  const opsRoutes = getOpsRoutes(routesIndex);
  const permissions: RoutePermission[] = [];

  const summary = {
    public: 0,
    authenticated: 0,
    admin: 0,
    superadmin: 0,
  };

  for (const route of opsRoutes) {
    const { level, reason } = determinePermissionLevel(route);
    const suggestions = MIDDLEWARE_SUGGESTIONS[level];

    permissions.push({
      route,
      requiredLevel: level,
      reason,
      suggestedMiddleware: suggestions.middleware,
      suggestedGuard: suggestions.guard,
    });

    summary[level]++;
  }

  // Sort by permission level (most restrictive first)
  const levelOrder: PermissionLevel[] = ['superadmin', 'admin', 'authenticated', 'public'];
  permissions.sort((a, b) =>
    levelOrder.indexOf(a.requiredLevel) - levelOrder.indexOf(b.requiredLevel)
  );

  // Generate recommendations
  const recommendations: string[] = [];

  if (summary.superadmin > 0) {
    recommendations.push(
      `⚠️ ${summary.superadmin} route(s) require superadmin access - verify these are properly protected`
    );
  }

  if (summary.admin > 0) {
    recommendations.push(
      `🔐 ${summary.admin} route(s) require admin access - implement role-based guards`
    );
  }

  if (summary.authenticated === opsRoutes.length) {
    recommendations.push(
      '✅ All ops routes require authentication - good baseline security'
    );
  }

  if (summary.public > 0) {
    recommendations.push(
      `⚡ ${summary.public} route(s) are public - review if this is intentional`
    );
  }

  // Check for consistent middleware
  const hasInconsistentLevels = permissions.some(p =>
    p.route.urlPath.includes('/admin') && p.requiredLevel !== 'admin'
  );

  if (hasInconsistentLevels) {
    recommendations.push(
      '⚠️ Some routes with "admin" in path may not require admin permission - review manually'
    );
  }

  console.log(`[opsPermissionsPlanner] Found ${opsRoutes.length} ops routes`);

  return {
    success: true,
    totalOpsRoutes: opsRoutes.length,
    permissions,
    summary,
    recommendations,
  };
}

/**
 * Get permission requirements for a specific route
 */
export function getRoutePermission(
  route: IndexedRoute
): { level: PermissionLevel; reason: string } {
  return determinePermissionLevel(route);
}

/**
 * Check if a route requires admin access
 */
export function requiresAdmin(route: IndexedRoute): boolean {
  const { level } = determinePermissionLevel(route);
  return level === 'admin' || level === 'superadmin';
}

/**
 * Get suggested guard code for a route
 */
export function getSuggestedGuardCode(
  route: IndexedRoute,
  language: 'ar' | 'en' = 'en'
): string {
  const { level } = determinePermissionLevel(route);

  switch (level) {
    case 'superadmin':
      return language === 'ar'
        ? `// يتطلب صلاحية Super Admin
const { user, isSuperAdmin } = useAuth();
if (!isSuperAdmin) redirect('/unauthorized');`
        : `// Requires Super Admin access
const { user, isSuperAdmin } = useAuth();
if (!isSuperAdmin) redirect('/unauthorized');`;

    case 'admin':
      return language === 'ar'
        ? `// يتطلب صلاحية Admin
const { user, isAdmin } = useAuth();
if (!isAdmin) redirect('/unauthorized');`
        : `// Requires Admin access
const { user, isAdmin } = useAuth();
if (!isAdmin) redirect('/unauthorized');`;

    case 'authenticated':
      return language === 'ar'
        ? `// يتطلب تسجيل دخول
const { user } = useAuth();
if (!user) redirect('/login');`
        : `// Requires authentication
const { user } = useAuth();
if (!user) redirect('/login');`;

    default:
      return language === 'ar'
        ? '// صفحة عامة - لا يتطلب صلاحيات'
        : '// Public page - no auth required';
  }
}

/**
 * Format permissions plan for display
 */
export function formatPermissionsPlan(
  plan: OpsPermissionsPlan,
  language: 'ar' | 'en' = 'ar'
): string {
  const isArabic = language === 'ar';

  const header = isArabic
    ? `🔐 خطة صلاحيات Ops (${plan.totalOpsRoutes} route)\n`
    : `🔐 Ops Permissions Plan (${plan.totalOpsRoutes} routes)\n`;

  const summarySection = isArabic
    ? `\n📊 ملخص:\n- Superadmin: ${plan.summary.superadmin}\n- Admin: ${plan.summary.admin}\n- مصادق: ${plan.summary.authenticated}\n- عام: ${plan.summary.public}`
    : `\n📊 Summary:\n- Superadmin: ${plan.summary.superadmin}\n- Admin: ${plan.summary.admin}\n- Authenticated: ${plan.summary.authenticated}\n- Public: ${plan.summary.public}`;

  const routesSection = plan.permissions
    .slice(0, 10)
    .map(p => {
      const levelEmoji =
        p.requiredLevel === 'superadmin' ? '🛡️' :
        p.requiredLevel === 'admin' ? '🔐' :
        p.requiredLevel === 'authenticated' ? '🔑' : '🌐';

      return `${levelEmoji} ${p.route.urlPath}\n   └─ ${p.reason} (${p.suggestedGuard})`;
    })
    .join('\n\n');

  const recommendationsSection = plan.recommendations.length > 0
    ? (isArabic ? '\n\n💡 توصيات:\n' : '\n\n💡 Recommendations:\n') +
      plan.recommendations.map(r => `  ${r}`).join('\n')
    : '';

  return header + summarySection + '\n\n📋 Routes:\n' + routesSection + recommendationsSection;
}

export default planOpsPermissions;
