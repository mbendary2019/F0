// desktop/src/lib/agent/tools/routeResolver.ts
// Phase 124.3: Route Resolver Tool for Smart Route-Aware Agent
// Resolves natural language queries like "فين صفحة تسجيل الدخول؟" to file paths

import type {
  IndexedRoute,
  RoutesIndex,
  RouteSearchResult,
} from '../../../../indexer/types';
import { ROUTE_SEMANTIC_TAGS } from '../../../../indexer/types';

/**
 * Route resolver tool configuration
 */
export interface RouteResolverConfig {
  language?: 'ar' | 'en';
  maxResults?: number;
  minScore?: number;
}

/**
 * Route resolver result
 * Phase 124.3.1: Enhanced with primary file path and top 3 results
 */
export interface RouteResolverResult {
  success: boolean;
  query: string;
  results: RouteSearchResult[];
  totalRoutes: number;
  message: string;
  /** Primary result file path (best match) - for auto-open */
  primaryFilePath?: string;
  /** Top 3 file paths for quick display */
  topFilePaths?: string[];
}

/**
 * Expanded semantic tags with more Arabic/English synonyms
 */
const EXPANDED_SEMANTIC_TAGS: Record<string, string[]> = {
  ...ROUTE_SEMANTIC_TAGS,

  // Login / Auth variations
  'تسجيل الدخول': ['auth', 'login', 'signin'],
  'تسجيل': ['auth', 'login', 'register', 'signin', 'signup'],
  'دخول': ['auth', 'login', 'signin'],
  'مصادقة': ['auth', 'authentication'],
  'حساب جديد': ['register', 'signup'],
  'إنشاء حساب': ['register', 'signup'],

  // Dashboard
  'لوحة التحكم': ['dashboard', 'home', 'main'],
  'الرئيسية': ['home', 'index', 'dashboard'],
  'البداية': ['home', 'index'],

  // Settings
  'إعدادات': ['settings', 'preferences', 'config'],
  'تفضيلات': ['settings', 'preferences'],
  'الملف الشخصي': ['profile', 'account', 'user'],
  'حسابي': ['profile', 'account'],

  // Projects
  'مشاريع': ['projects'],
  'المشاريع': ['projects'],
  'مشروع': ['project', 'projects'],

  // Billing
  'فواتير': ['billing', 'payment', 'invoice'],
  'دفع': ['billing', 'payment', 'checkout'],
  'اشتراك': ['billing', 'subscription', 'plan'],
  'محفظة': ['wallet', 'balance'],
  'رصيد': ['wallet', 'balance', 'credits'],
  'أسعار': ['pricing', 'plans'],

  // API
  'واجهة': ['api', 'endpoint'],
  'نقطة': ['api', 'endpoint'],

  // Chat
  'محادثة': ['chat', 'conversation', 'message'],
  'دردشة': ['chat', 'conversation'],
  'رسائل': ['chat', 'messages'],

  // Users
  'مستخدمين': ['users', 'members'],
  'أعضاء': ['users', 'members'],
};

/**
 * Tokenize query into searchable terms
 */
function tokenizeQuery(query: string): string[] {
  // Remove common question words and punctuation
  const cleanQuery = query
    .toLowerCase()
    .replace(/[؟?!.,:;'"]/g, '')
    .replace(/فين|وين|أين|where|find|show|what|how|which/gi, '')
    .replace(/صفحة|ملف|route|page|file|endpoint/gi, '')
    .replace(/the|a|an|is|are|of|for/gi, '')
    .trim();

  // Split into tokens
  const tokens = cleanQuery.split(/\s+/).filter(t => t.length > 1);

  // Expand tokens with semantic tags
  const expandedTokens: string[] = [];

  for (const token of tokens) {
    expandedTokens.push(token);

    // Check for semantic expansions
    const expansions = EXPANDED_SEMANTIC_TAGS[token];
    if (expansions) {
      expandedTokens.push(...expansions);
    }

    // Check if token is in any expansion values
    for (const [key, values] of Object.entries(EXPANDED_SEMANTIC_TAGS)) {
      if (values.includes(token) && !expandedTokens.includes(key)) {
        expandedTokens.push(...values);
      }
    }
  }

  return [...new Set(expandedTokens)];
}

/**
 * Calculate match score between query tokens and route
 */
function calculateMatchScore(
  tokens: string[],
  route: IndexedRoute
): { score: number; reason: string } {
  let score = 0;
  const matchReasons: string[] = [];

  // Check URL path
  const urlPathLower = route.urlPath.toLowerCase();
  for (const token of tokens) {
    if (urlPathLower.includes(token)) {
      score += 0.3;
      matchReasons.push(`url: ${token}`);
    }
  }

  // Check locale-agnostic path
  const localePathLower = route.localeAgnosticPath.toLowerCase();
  for (const token of tokens) {
    if (localePathLower.includes(token)) {
      score += 0.2;
      matchReasons.push(`path: ${token}`);
    }
  }

  // Check segments
  for (const segment of route.segments) {
    for (const token of tokens) {
      if (segment === token || segment.includes(token)) {
        score += 0.25;
        matchReasons.push(`segment: ${segment}`);
      }
    }
  }

  // Check semantic tags (highest weight)
  for (const tag of route.tags) {
    for (const token of tokens) {
      if (tag === token) {
        score += 0.4;
        matchReasons.push(`tag: ${tag}`);
      } else if (tag.includes(token) || token.includes(tag)) {
        score += 0.2;
        matchReasons.push(`tag~: ${tag}`);
      }
    }
  }

  // Check file system path
  const fsPathLower = route.fsPath.toLowerCase();
  for (const token of tokens) {
    if (fsPathLower.includes(token)) {
      score += 0.15;
      matchReasons.push(`fs: ${token}`);
    }
  }

  // Normalize score to 0-1
  const normalizedScore = Math.min(score, 1);

  // Create reason string
  const uniqueReasons = [...new Set(matchReasons)].slice(0, 3);
  const reason = uniqueReasons.join(', ');

  return { score: normalizedScore, reason };
}

/**
 * Resolve natural language query to routes
 *
 * Examples:
 * - "فين صفحة تسجيل الدخول؟" → auth page
 * - "where is the billing page?" → billing page
 * - "show me the chat API" → chat API route
 * - "المشاريع" → projects page
 */
export function resolveRouteQuery(
  query: string,
  routesIndex: RoutesIndex,
  config: RouteResolverConfig = {}
): RouteResolverResult {
  const {
    language = 'ar',
    maxResults = 5,
    minScore = 0.2,
  } = config;

  console.log('[routeResolver] Query:', query);

  // Tokenize query
  const tokens = tokenizeQuery(query);
  console.log('[routeResolver] Tokens:', tokens);

  if (tokens.length === 0) {
    return {
      success: false,
      query,
      results: [],
      totalRoutes: routesIndex.routes.length,
      message: language === 'ar'
        ? 'لم أفهم السؤال. جرب "فين صفحة تسجيل الدخول؟"'
        : 'Could not understand query. Try "where is the login page?"',
    };
  }

  // Score all routes
  const scoredRoutes: RouteSearchResult[] = [];

  for (const route of routesIndex.routes) {
    const { score, reason } = calculateMatchScore(tokens, route);

    if (score >= minScore) {
      scoredRoutes.push({ route, score, reason });
    }
  }

  // Sort by score descending
  scoredRoutes.sort((a, b) => b.score - a.score);

  // Take top results
  const results = scoredRoutes.slice(0, maxResults);

  // Phase 124.3.1: Extract top 3 file paths (fsPath first priority)
  const top3 = results.slice(0, 3);
  const topFilePaths = top3.map(r => r.route.fsPath);
  const primaryFilePath = results.length > 0 ? results[0].route.fsPath : undefined;

  // Build response message - always show fsPath (not urlPath)
  let message: string;

  if (results.length === 0) {
    message = language === 'ar'
      ? `لم أجد route مطابق لـ "${query}". المشروع يحتوي على ${routesIndex.stats.pageCount} صفحة و ${routesIndex.stats.apiCount} API.`
      : `No matching route found for "${query}". Project has ${routesIndex.stats.pageCount} pages and ${routesIndex.stats.apiCount} APIs.`;
  } else if (results.length === 1) {
    const r = results[0].route;
    message = language === 'ar'
      ? `📁 ${r.fsPath}\n   (${r.kind === 'api' ? 'API' : 'صفحة'} - ${r.urlPath})`
      : `📁 ${r.fsPath}\n   (${r.kind} - ${r.urlPath})`;
  } else {
    // Show top 3 with fsPath as primary
    const top3Display = top3.map((r, i) => {
      const kind = r.route.kind === 'api' ? 'API' : (language === 'ar' ? 'صفحة' : 'page');
      const score = Math.round(r.score * 100);
      return `${i + 1}. 📁 ${r.route.fsPath}\n   (${kind} - ${r.route.urlPath}) ${score}%`;
    }).join('\n\n');

    message = language === 'ar'
      ? `وجدت ${results.length} نتائج:\n\n${top3Display}`
      : `Found ${results.length} matches:\n\n${top3Display}`;
  }

  console.log('[routeResolver] Results:', results.length, 'Primary:', primaryFilePath);

  return {
    success: results.length > 0,
    query,
    results,
    totalRoutes: routesIndex.routes.length,
    message,
    primaryFilePath,
    topFilePaths,
  };
}

/**
 * Find API route by URL path
 * Useful for "which API handles /api/chat?"
 */
export function findApiByPath(
  urlPath: string,
  routesIndex: RoutesIndex
): IndexedRoute | null {
  // Normalize path
  const normalizedPath = urlPath.startsWith('/') ? urlPath : '/' + urlPath;

  // Exact match first
  const exactMatch = routesIndex.routes.find(
    r => r.kind === 'api' && (r.urlPath === normalizedPath || r.localeAgnosticPath === normalizedPath)
  );

  if (exactMatch) {
    return exactMatch;
  }

  // Try matching without /api prefix
  const withoutApiPrefix = normalizedPath.replace(/^\/api/, '');
  const withApiPrefix = '/api' + (withoutApiPrefix.startsWith('/') ? '' : '/') + withoutApiPrefix;

  return routesIndex.routes.find(
    r => r.kind === 'api' && (r.urlPath === withApiPrefix || r.localeAgnosticPath === withApiPrefix)
  ) || null;
}

/**
 * Find page by URL path
 */
export function findPageByPath(
  urlPath: string,
  routesIndex: RoutesIndex
): IndexedRoute | null {
  // Normalize path
  const normalizedPath = urlPath.startsWith('/') ? urlPath : '/' + urlPath;

  // Exact match first
  const exactMatch = routesIndex.routes.find(
    r => r.kind === 'page' && (r.urlPath === normalizedPath || r.localeAgnosticPath === normalizedPath)
  );

  return exactMatch || null;
}

/**
 * Get all routes by kind
 */
export function getRoutesByKind(
  kind: 'page' | 'api',
  routesIndex: RoutesIndex
): IndexedRoute[] {
  return routesIndex.routes.filter(r => r.kind === kind);
}

/**
 * Search routes by tag
 */
export function searchRoutesByTag(
  tag: string,
  routesIndex: RoutesIndex
): IndexedRoute[] {
  const lowerTag = tag.toLowerCase();
  return routesIndex.routes.filter(r =>
    r.tags.some(t => t.toLowerCase().includes(lowerTag))
  );
}

/**
 * Format route for display in agent response
 */
export function formatRouteForDisplay(
  route: IndexedRoute,
  language: 'ar' | 'en' = 'ar'
): string {
  const kindLabel = route.kind === 'api'
    ? (language === 'ar' ? 'API' : 'API')
    : (language === 'ar' ? 'صفحة' : 'Page');

  const methodsStr = route.methods?.length
    ? ` [${route.methods.join(', ')}]`
    : '';

  const dynamicLabel = route.isDynamic
    ? (language === 'ar' ? ' (ديناميكي)' : ' (dynamic)')
    : '';

  return `📄 ${kindLabel}: ${route.urlPath}${methodsStr}${dynamicLabel}\n   └─ ${route.fsPath}`;
}

/**
 * Format multiple routes for display
 */
export function formatRoutesForDisplay(
  results: RouteSearchResult[],
  language: 'ar' | 'en' = 'ar'
): string {
  if (results.length === 0) {
    return language === 'ar'
      ? 'لم يتم العثور على نتائج'
      : 'No results found';
  }

  return results
    .map((r, i) => {
      const scorePercent = Math.round(r.score * 100);
      const prefix = `${i + 1}. `;
      return `${prefix}${formatRouteForDisplay(r.route, language)} (${scorePercent}%)`;
    })
    .join('\n\n');
}

export default resolveRouteQuery;
