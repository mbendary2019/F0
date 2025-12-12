// desktop/src/lib/agent/prompts/routeAwarePrompt.ts
// Phase 124.3: Route-Aware Agent Prompts
// Phase 124.4: Added API Inspection prompts
// Phase 124.4.1: Added API Query Router (resolveApiIntentFromQuery)
// Phase 124.5: Added API Debugging prompts
// Builds prompts that include routes index context for smart route resolution

import type { RoutesIndex, IndexedRoute } from '../../../../indexer/types';

/**
 * Phase 124.4.1: API Query Intent Types
 * Determines whether to inspect existing API or design new one
 */
export type ApiQueryIntent =
  | { kind: 'inspect_existing'; urlPath: string }
  | { kind: 'debug_api'; urlPath: string }  // Phase 124.5
  | { kind: 'design_new' }
  | { kind: 'not_api' };

/**
 * Synonyms for common API endpoints (Arabic/English)
 */
const API_SYNONYMS: Record<string, string[]> = {
  login: ['تسجيل الدخول', 'دخول', 'login', 'signin', 'sign-in', 'auth'],
  register: ['تسجيل', 'إنشاء حساب', 'register', 'signup', 'sign-up'],
  logout: ['خروج', 'تسجيل الخروج', 'logout', 'signout', 'sign-out'],
  chat: ['محادثة', 'دردشة', 'chat', 'message', 'رسائل'],
  billing: ['دفع', 'فواتير', 'billing', 'payment', 'checkout'],
  projects: ['مشاريع', 'projects', 'project'],
  users: ['مستخدمين', 'users', 'user', 'account'],
  settings: ['إعدادات', 'settings', 'preferences'],
};

/**
 * Phase 124.4.1: Resolve API intent from natural language query
 * Determines whether to inspect existing API, debug it, or design new one
 */
export function resolveApiIntentFromQuery(
  message: string,
  routesIndex?: RoutesIndex
): ApiQueryIntent {
  const q = message.toLowerCase().trim();

  // 0) Not an API query at all
  if (!q.includes('api') && !q.includes('/api/') && !isApiRelatedQuery(q)) {
    return { kind: 'not_api' };
  }

  // 1) Check for debugging keywords (Phase 124.5)
  const debugPatterns = [
    /ليه.*بيرجع|ليه.*مش شغال|ليه.*بيكسر/,
    /why.*return|why.*fail|why.*error|why.*broken/i,
    /مش شغال|بيكسر|خطأ|error|500|404|403|401/i,
    /debug|مشكلة|problem|issue|fix/i,
  ];

  const isDebugQuery = debugPatterns.some(p => p.test(q));

  // 2) Check for explicit URL path /api/...
  const urlMatch = q.match(/\/api\/[^\s'"`?]+/);
  if (urlMatch) {
    const urlPath = urlMatch[0].replace(/[?#].*$/, ''); // Remove query params
    if (isDebugQuery) {
      return { kind: 'debug_api', urlPath };
    }
    return { kind: 'inspect_existing', urlPath };
  }

  // 3) Try to resolve from synonyms
  if (routesIndex) {
    const resolvedUrl = tryResolveApiFromSynonyms(q, routesIndex);
    if (resolvedUrl) {
      if (isDebugQuery) {
        return { kind: 'debug_api', urlPath: resolvedUrl };
      }
      return { kind: 'inspect_existing', urlPath: resolvedUrl };
    }
  }

  // 4) Check for "create/build/design" keywords → design_new
  const designPatterns = [
    /عايز أعمل|عايز اعمل|عاوز أعمل/,
    /اعمل.*api|أعمل.*api/i,
    /create.*api|build.*api|design.*api|make.*api/i,
    /new.*api|api.*new/i,
    /implement.*api/i,
  ];

  if (designPatterns.some(p => p.test(q))) {
    return { kind: 'design_new' };
  }

  // 5) If mentions API but no specific endpoint found → design_new
  if (q.includes('api')) {
    return { kind: 'design_new' };
  }

  return { kind: 'not_api' };
}

/**
 * Check if query is API-related even without explicit "api" keyword
 */
function isApiRelatedQuery(query: string): boolean {
  const patterns = [
    /endpoint|route.*handler|handler/i,
    /backend|server.*side/i,
    /post.*request|get.*request/i,
  ];
  return patterns.some(p => p.test(query));
}

/**
 * Try to resolve API URL from synonyms and route index
 */
function tryResolveApiFromSynonyms(
  query: string,
  routesIndex: RoutesIndex
): string | null {
  const q = query.toLowerCase();

  // Check each synonym category
  for (const [category, synonyms] of Object.entries(API_SYNONYMS)) {
    const hasMatch = synonyms.some(syn => q.includes(syn.toLowerCase()));
    if (!hasMatch) continue;

    // Try to find matching API route
    const apiRoutes = routesIndex.routes.filter(r => r.kind === 'api');

    for (const route of apiRoutes) {
      const urlLower = route.urlPath.toLowerCase();
      const pathLower = route.fsPath.toLowerCase();

      // Check if route matches category
      if (urlLower.includes(category) || pathLower.includes(category)) {
        return route.urlPath;
      }

      // Check tags
      if (route.tags?.some(t => t.toLowerCase().includes(category))) {
        return route.urlPath;
      }
    }
  }

  return null;
}

/**
 * Route-aware prompt options
 */
export interface RouteAwarePromptOptions {
  routesIndex: RoutesIndex;
  language?: 'ar' | 'en';
  maxRoutes?: number;
}

/**
 * Format routes for inclusion in prompt
 */
function formatRoutesForPrompt(
  routes: IndexedRoute[],
  maxRoutes: number = 30
): string {
  const displayed = routes.slice(0, maxRoutes);
  const remaining = routes.length - maxRoutes;

  const formatted = displayed.map(r => {
    const methods = r.methods ? ` [${r.methods.join(',')}]` : '';
    const dynamic = r.isDynamic ? ' *' : '';
    return `  - ${r.urlPath}${methods}${dynamic} → ${r.fsPath}`;
  }).join('\n');

  if (remaining > 0) {
    return `${formatted}\n  ... +${remaining} more routes`;
  }

  return formatted;
}

/**
 * Build route-aware system message for agent
 * Injects routes context into the system prompt
 */
export function buildRouteAwareSystemMessage(
  options: RouteAwarePromptOptions
): string {
  const { routesIndex, language = 'ar', maxRoutes = 30 } = options;
  const isArabic = language === 'ar';

  const pages = routesIndex.routes.filter(r => r.kind === 'page');
  const apis = routesIndex.routes.filter(r => r.kind === 'api');

  const pagesFormatted = formatRoutesForPrompt(pages, maxRoutes);
  const apisFormatted = formatRoutesForPrompt(apis, maxRoutes);

  if (isArabic) {
    return `أنت وكيل كود F0 يعرف بنية المشروع بالكامل.

🗺️ خريطة الـ Routes:

📄 الصفحات (${pages.length}):
${pagesFormatted}

🔌 APIs (${apis.length}):
${apisFormatted}

📌 تعليمات مهمة:
- عندما يسأل المستخدم "فين صفحة X؟" استخدم القائمة أعلاه للإجابة
- أشر دائماً للملف الكامل مثل: (src/app/auth/page.tsx)
- إذا سأل عن API، حدد الـ methods المتاحة [GET, POST, etc]
- المسارات الـ dynamic (ديناميكية) موضحة بـ *
- لا تخترع routes غير موجودة في القائمة

🔧 أدوات متاحة:
- resolve_route: للبحث عن route بلغة طبيعية
- find_api: للبحث عن API handler بالمسار
- plan_ops_permissions: لتحليل صلاحيات /ops
- inspect_api: لتحليل API endpoint (methods, auth, validation, errors)
- get_api_security: للحصول على توصيات أمان لـ API
- debug_api: لتصحيح API مش شغال (يجمع تحليل الكود + logs)

💡 أمثلة للأسئلة:
- "ما هي الـ methods في /api/chat؟"
- "هل /api/billing محمي؟"
- "مين بيستخدم /api/projects؟"
- "ليه /api/auth/login بيرجع 500؟"
- "إيه المشكلة في /api/checkout؟"

🔴 تصحيح الأخطاء:
لما المستخدم يسأل "ليه endpoint X بيكسر؟" أو "مش شغال":
1. استخدم debug_api لتحليل الكود + الـ logs
2. لخّص السبب المحتمل (root cause)
3. اقترح خطة إصلاح + code patch`;
  }

  return `You are F0 Code Agent with full knowledge of project structure.

🗺️ Routes Map:

📄 Pages (${pages.length}):
${pagesFormatted}

🔌 APIs (${apis.length}):
${apisFormatted}

📌 Important Instructions:
- When user asks "where is page X?" use the list above to answer
- Always reference the full file path like: (src/app/auth/page.tsx)
- For API questions, specify available methods [GET, POST, etc]
- Dynamic routes are marked with *
- Do NOT invent routes not in the list

🔧 Available Tools:
- resolve_route: Search for routes using natural language
- find_api: Find API handler by URL path
- plan_ops_permissions: Analyze /ops routes permissions
- inspect_api: Analyze API endpoint (methods, auth, validation, errors)
- get_api_security: Get security recommendations for an API
- debug_api: Debug a failing API (combines code analysis + logs)

💡 Example Questions:
- "What methods does /api/chat support?"
- "Is /api/billing protected?"
- "Who consumes /api/projects?"
- "Why is /api/auth/login returning 500?"
- "What's wrong with /api/checkout?"

🔴 Debugging:
When user asks "why is endpoint X failing?" or "not working":
1. Use debug_api to analyze code + runtime logs
2. Summarize the probable root cause
3. Suggest a fix plan + code patch`;
}

/**
 * Build route context section for appending to messages
 */
export function buildRouteContextSection(
  options: RouteAwarePromptOptions
): string {
  const { routesIndex, language = 'ar' } = options;
  const isArabic = language === 'ar';

  const stats = routesIndex.stats;

  if (isArabic) {
    return `
📊 إحصائيات Routes:
- صفحات: ${stats.pageCount}
- APIs: ${stats.apiCount}
- Dynamic: ${stats.dynamicCount}
- آخر تحديث: ${new Date(routesIndex.indexedAt).toLocaleString('ar-EG')}`;
  }

  return `
📊 Routes Stats:
- Pages: ${stats.pageCount}
- APIs: ${stats.apiCount}
- Dynamic: ${stats.dynamicCount}
- Last indexed: ${new Date(routesIndex.indexedAt).toLocaleString('en-US')}`;
}

/**
 * Build route query enhancement for user questions about routes
 * Adds context hints when user asks route-related questions
 */
export function enhanceRouteQuery(
  query: string,
  routesIndex: RoutesIndex,
  language: 'ar' | 'en' = 'ar'
): string {
  const isArabic = language === 'ar';

  // Check if query is route-related
  const routePatterns = [
    /فين|وين|أين|where|find|locate/i,
    /صفحة|page|route|endpoint|api/i,
    /تسجيل|login|auth|دخول/i,
    /دفع|billing|payment|checkout/i,
  ];

  const isRouteQuery = routePatterns.some(p => p.test(query));

  if (!isRouteQuery) {
    return query;
  }

  // Add route context hint
  const hint = isArabic
    ? `[استخدم routes-index للإجابة - ${routesIndex.stats.pageCount} صفحة، ${routesIndex.stats.apiCount} API]`
    : `[Use routes-index to answer - ${routesIndex.stats.pageCount} pages, ${routesIndex.stats.apiCount} APIs]`;

  return `${query}\n\n${hint}`;
}

/**
 * Check if a query is asking about routes
 */
export function isRouteQuery(query: string): boolean {
  const patterns = [
    // Arabic patterns
    /فين|وين|أين/,
    /صفحة|الصفحة/,
    /مسار|route/i,
    /api|endpoint/i,
    // English patterns
    /where\s+(is|are)/i,
    /find\s+(the|a)/i,
    /show\s+me/i,
    /which\s+(file|route|page)/i,
    /locate/i,
  ];

  return patterns.some(p => p.test(query));
}

/**
 * Phase 124.4: Check if a query is asking about API details
 * Phase 124.4.1: Updated to use resolveApiIntentFromQuery
 */
export function isApiInspectionQuery(
  query: string,
  routesIndex?: RoutesIndex
): boolean {
  const intent = resolveApiIntentFromQuery(query, routesIndex);
  return intent.kind === 'inspect_existing';
}

/**
 * Phase 124.5: Check if a query is asking to debug an API
 */
export function isApiDebugQuery(
  query: string,
  routesIndex?: RoutesIndex
): boolean {
  const intent = resolveApiIntentFromQuery(query, routesIndex);
  return intent.kind === 'debug_api';
}

/**
 * Get suggested routes based on partial query
 */
export function getSuggestedRoutes(
  partialQuery: string,
  routesIndex: RoutesIndex,
  maxSuggestions: number = 5
): IndexedRoute[] {
  const query = partialQuery.toLowerCase();

  // Score routes by relevance
  const scored = routesIndex.routes.map(route => {
    let score = 0;

    // Check URL path
    if (route.urlPath.toLowerCase().includes(query)) {
      score += 3;
    }

    // Check tags
    for (const tag of route.tags) {
      if (tag.toLowerCase().includes(query)) {
        score += 2;
      }
    }

    // Check segments
    for (const segment of route.segments) {
      if (segment.includes(query)) {
        score += 1;
      }
    }

    return { route, score };
  });

  // Sort by score and return top matches
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions)
    .map(s => s.route);
}

export default {
  buildRouteAwareSystemMessage,
  buildRouteContextSection,
  enhanceRouteQuery,
  isRouteQuery,
  isApiInspectionQuery,
  isApiDebugQuery,
  resolveApiIntentFromQuery,
  getSuggestedRoutes,
};
