// desktop/src/lib/agent/tools/apiInspector.ts
// Phase 124.4: Smart API Inspector Tool
// Analyzes API routes to extract methods, auth, validation, errors, and find consumers

import type { IndexedRoute, RoutesIndex } from '../../../../indexer/types';
import { findApiByPath } from './routeResolver';

/**
 * HTTP Methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Auth hint patterns detected in code
 */
export type AuthHint =
  | 'none'
  | 'session'
  | 'firebase-auth'
  | 'api-key'
  | 'bearer-token'
  | 'custom';

/**
 * API Endpoint Metadata extracted from route.ts file
 */
export interface ApiEndpointMetadata {
  urlPath: string;
  fsPath: string;
  methods: HttpMethod[];
  authHint: AuthHint;
  authDetails?: string;
  validationHints: string[];
  errorCodes: number[];
  exports: string[];
  isDynamic: boolean;
  dynamicParams?: string[];
}

/**
 * API Consumer Reference - where the API is called from
 */
export interface ApiConsumerReference {
  filePath: string;
  lineNumber?: number;
  callPattern: 'fetch' | 'axios' | 'useSWR' | 'useQuery' | 'custom';
  snippet?: string;
}

/**
 * API Inspector Input
 */
export interface ApiInspectorInput {
  urlPath?: string;
  fsPath?: string;
  routesIndex: RoutesIndex;
  projectRoot: string;
  includeConsumers?: boolean;
  readFile?: (path: string) => Promise<string>;
}

/**
 * API Inspector Output
 */
export interface ApiInspectorOutput {
  success: boolean;
  metadata?: ApiEndpointMetadata;
  consumers?: ApiConsumerReference[];
  message: string;
  suggestions?: string[];
}

/**
 * Patterns to detect HTTP methods in route files
 */
const METHOD_PATTERNS: Record<HttpMethod, RegExp[]> = {
  GET: [
    /export\s+(async\s+)?function\s+GET/,
    /export\s+const\s+GET/,
    /\.get\s*\(/,
  ],
  POST: [
    /export\s+(async\s+)?function\s+POST/,
    /export\s+const\s+POST/,
    /\.post\s*\(/,
  ],
  PUT: [
    /export\s+(async\s+)?function\s+PUT/,
    /export\s+const\s+PUT/,
    /\.put\s*\(/,
  ],
  PATCH: [
    /export\s+(async\s+)?function\s+PATCH/,
    /export\s+const\s+PATCH/,
    /\.patch\s*\(/,
  ],
  DELETE: [
    /export\s+(async\s+)?function\s+DELETE/,
    /export\s+const\s+DELETE/,
    /\.delete\s*\(/,
  ],
  HEAD: [
    /export\s+(async\s+)?function\s+HEAD/,
    /export\s+const\s+HEAD/,
  ],
  OPTIONS: [
    /export\s+(async\s+)?function\s+OPTIONS/,
    /export\s+const\s+OPTIONS/,
  ],
};

/**
 * Patterns to detect authentication
 */
const AUTH_PATTERNS: { hint: AuthHint; patterns: RegExp[]; details?: string }[] = [
  {
    hint: 'firebase-auth',
    patterns: [
      /getAuth|verifyIdToken|firebase.*auth/i,
      /auth\(\)\.currentUser/,
      /getServerSession.*firebase/i,
    ],
    details: 'Firebase Authentication',
  },
  {
    hint: 'session',
    patterns: [
      /getServerSession|getSession|useSession/i,
      /next-auth|NextAuth/,
      /cookies\(\).*session/i,
    ],
    details: 'Session-based auth',
  },
  {
    hint: 'bearer-token',
    patterns: [
      /authorization.*bearer/i,
      /Bearer\s+token/i,
      /headers.*authorization/i,
    ],
    details: 'Bearer token auth',
  },
  {
    hint: 'api-key',
    patterns: [
      /x-api-key|apiKey|api_key/i,
      /headers.*['"](x-)?api[-_]?key/i,
    ],
    details: 'API Key auth',
  },
];

/**
 * Patterns to detect validation
 */
const VALIDATION_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'zod', pattern: /z\.\w+|zodSchema|\.parse\(|\.safeParse\(/i },
  { name: 'yup', pattern: /yup\.\w+|\.validate\(/i },
  { name: 'joi', pattern: /joi\.\w+|\.validateAsync\(/i },
  { name: 'manual-check', pattern: /if\s*\(\s*!.*\)\s*{\s*return.*Response|throw/i },
  { name: 'type-guard', pattern: /typeof\s+\w+\s*[!=]==?\s*['"]/ },
];

/**
 * Patterns to detect error responses
 */
const ERROR_CODE_PATTERN = /(?:status|Response)\s*\(\s*(?:null|undefined|.*?),?\s*\{\s*status:\s*(\d{3})|new\s+Response\s*\(.*?,\s*\{\s*status:\s*(\d{3})|NextResponse\.json\s*\(.*?,\s*\{\s*status:\s*(\d{3})/g;

/**
 * Consumer call patterns
 */
const CONSUMER_PATTERNS: { pattern: RegExp; type: ApiConsumerReference['callPattern'] }[] = [
  { pattern: /fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/g, type: 'fetch' },
  { pattern: /axios\.\w+\s*\(\s*[`'"]([^`'"]+)[`'"]/g, type: 'axios' },
  { pattern: /useSWR\s*\(\s*[`'"]([^`'"]+)[`'"]/g, type: 'useSWR' },
  { pattern: /useQuery\s*\(.*?[`'"]([^`'"]+)[`'"]/g, type: 'useQuery' },
];

/**
 * Extract HTTP methods from route file content
 */
function extractMethods(content: string): HttpMethod[] {
  const methods: HttpMethod[] = [];

  for (const [method, patterns] of Object.entries(METHOD_PATTERNS) as [HttpMethod, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        methods.push(method);
        break;
      }
    }
  }

  return methods.length > 0 ? methods : ['GET']; // Default to GET if none found
}

/**
 * Detect authentication pattern in route file
 */
function detectAuth(content: string): { hint: AuthHint; details?: string } {
  for (const { hint, patterns, details } of AUTH_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return { hint, details };
      }
    }
  }

  return { hint: 'none' };
}

/**
 * Detect validation patterns
 */
function detectValidation(content: string): string[] {
  const hints: string[] = [];

  for (const { name, pattern } of VALIDATION_PATTERNS) {
    if (pattern.test(content)) {
      hints.push(name);
    }
  }

  return hints;
}

/**
 * Extract error status codes from route file
 */
function extractErrorCodes(content: string): number[] {
  const codes: Set<number> = new Set();

  // Reset regex state
  ERROR_CODE_PATTERN.lastIndex = 0;

  let match;
  while ((match = ERROR_CODE_PATTERN.exec(content)) !== null) {
    const code = parseInt(match[1] || match[2] || match[3], 10);
    if (code >= 400 && code < 600) {
      codes.add(code);
    }
  }

  // Also check for common patterns
  if (/401|Unauthorized/i.test(content)) codes.add(401);
  if (/403|Forbidden/i.test(content)) codes.add(403);
  if (/404|Not\s*Found/i.test(content)) codes.add(404);
  if (/500|Internal.*Error/i.test(content)) codes.add(500);

  return Array.from(codes).sort((a, b) => a - b);
}

/**
 * Extract exports from route file
 */
function extractExports(content: string): string[] {
  const exports: string[] = [];

  // Named function exports
  const funcExportRegex = /export\s+(async\s+)?function\s+(\w+)/g;
  let match;
  while ((match = funcExportRegex.exec(content)) !== null) {
    exports.push(match[2]);
  }

  // Const exports
  const constExportRegex = /export\s+const\s+(\w+)/g;
  while ((match = constExportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  return [...new Set(exports)];
}

/**
 * Extract dynamic params from path
 */
function extractDynamicParams(urlPath: string): string[] {
  const params: string[] = [];
  const paramRegex = /\[([^\]]+)\]/g;

  let match;
  while ((match = paramRegex.exec(urlPath)) !== null) {
    params.push(match[1]);
  }

  return params;
}

/**
 * Infer API metadata from route file content
 */
export function inferApiMetadata(
  route: IndexedRoute,
  fileContent: string
): ApiEndpointMetadata {
  const methods = extractMethods(fileContent);
  const { hint: authHint, details: authDetails } = detectAuth(fileContent);
  const validationHints = detectValidation(fileContent);
  const errorCodes = extractErrorCodes(fileContent);
  const exports = extractExports(fileContent);
  const dynamicParams = extractDynamicParams(route.urlPath);

  return {
    urlPath: route.urlPath,
    fsPath: route.fsPath,
    methods,
    authHint,
    authDetails,
    validationHints,
    errorCodes,
    exports,
    isDynamic: route.isDynamic || dynamicParams.length > 0,
    dynamicParams: dynamicParams.length > 0 ? dynamicParams : undefined,
  };
}

/**
 * Walk project files to find API consumers
 */
export async function walkProjectForConsumers(
  projectRoot: string,
  apiUrlPath: string,
  readFile: (path: string) => Promise<string>,
  searchProjectIndex?: (query: string, type?: string) => Promise<Array<{ filePath: string; lineNumber?: number }>>
): Promise<ApiConsumerReference[]> {
  const consumers: ApiConsumerReference[] = [];

  // Normalize the API path for searching
  const searchPath = apiUrlPath.replace(/^\/?api\//, '').replace(/\[.*?\]/g, '');

  // If we have project index search, use it
  if (searchProjectIndex) {
    try {
      // Search for fetch/axios calls to this API
      const results = await searchProjectIndex(apiUrlPath, 'text');

      for (const result of results.slice(0, 10)) {
        // Skip the API route file itself
        if (result.filePath.includes('/api/') && result.filePath.endsWith('route.ts')) {
          continue;
        }

        try {
          const content = await readFile(result.filePath);

          // Determine call pattern
          let callPattern: ApiConsumerReference['callPattern'] = 'custom';

          if (/fetch\s*\(/.test(content)) callPattern = 'fetch';
          else if (/axios/.test(content)) callPattern = 'axios';
          else if (/useSWR/.test(content)) callPattern = 'useSWR';
          else if (/useQuery/.test(content)) callPattern = 'useQuery';

          consumers.push({
            filePath: result.filePath,
            lineNumber: result.lineNumber,
            callPattern,
          });
        } catch {
          // File read failed, skip
        }
      }
    } catch {
      // Search failed, continue without consumers
    }
  }

  return consumers;
}

/**
 * Inspect an API endpoint
 * Main function that combines route lookup, metadata extraction, and consumer discovery
 */
export async function inspectApiEndpoint(
  input: ApiInspectorInput
): Promise<ApiInspectorOutput> {
  const {
    urlPath,
    fsPath,
    routesIndex,
    projectRoot,
    includeConsumers = false,
    readFile
  } = input;

  // Find the route
  let route: IndexedRoute | null = null;

  if (urlPath) {
    route = findApiByPath(urlPath, routesIndex);
  } else if (fsPath) {
    route = routesIndex.routes.find(r => r.fsPath === fsPath && r.kind === 'api') || null;
  }

  if (!route) {
    return {
      success: false,
      message: urlPath
        ? `API route not found: ${urlPath}`
        : `API route file not found: ${fsPath}`,
      suggestions: [
        'Check if the API route exists in routes-index.json',
        'Run the routes indexer to update the index',
        `Available APIs: ${routesIndex.stats.apiCount}`,
      ],
    };
  }

  // Read the route file content
  if (!readFile) {
    return {
      success: false,
      message: 'File reader not provided - cannot analyze route file',
    };
  }

  let fileContent: string;
  try {
    const fullPath = `${projectRoot}/${route.fsPath}`;
    fileContent = await readFile(fullPath);
  } catch (err) {
    return {
      success: false,
      message: `Failed to read route file: ${route.fsPath}`,
      suggestions: ['Check if the file exists at the specified path'],
    };
  }

  // Extract metadata
  const metadata = inferApiMetadata(route, fileContent);

  // Find consumers if requested
  let consumers: ApiConsumerReference[] | undefined;
  if (includeConsumers) {
    consumers = await walkProjectForConsumers(
      projectRoot,
      route.urlPath,
      readFile
    );
  }

  // Build response message
  const methodsStr = metadata.methods.join(', ');
  const authStr = metadata.authHint === 'none'
    ? '🔓 No auth'
    : `🔐 ${metadata.authDetails || metadata.authHint}`;
  const validationStr = metadata.validationHints.length > 0
    ? `✅ Validation: ${metadata.validationHints.join(', ')}`
    : '⚠️ No validation detected';
  const errorsStr = metadata.errorCodes.length > 0
    ? `❌ Error codes: ${metadata.errorCodes.join(', ')}`
    : 'No error responses detected';

  let message = `📡 ${metadata.urlPath}\n`;
  message += `📁 ${metadata.fsPath}\n\n`;
  message += `🔧 Methods: ${methodsStr}\n`;
  message += `${authStr}\n`;
  message += `${validationStr}\n`;
  message += `${errorsStr}\n`;
  message += `📤 Exports: ${metadata.exports.join(', ') || 'None detected'}`;

  if (metadata.isDynamic && metadata.dynamicParams) {
    message += `\n🔀 Dynamic params: ${metadata.dynamicParams.join(', ')}`;
  }

  if (consumers && consumers.length > 0) {
    message += `\n\n📥 Consumers (${consumers.length}):\n`;
    message += consumers
      .slice(0, 5)
      .map(c => `  - ${c.filePath} (${c.callPattern})`)
      .join('\n');
    if (consumers.length > 5) {
      message += `\n  ... +${consumers.length - 5} more`;
    }
  }

  // Generate suggestions based on findings
  const suggestions: string[] = [];

  if (metadata.authHint === 'none') {
    suggestions.push('⚠️ Consider adding authentication if this API handles sensitive data');
  }

  if (metadata.validationHints.length === 0 && metadata.methods.includes('POST')) {
    suggestions.push('⚠️ POST endpoint without validation - consider adding zod or yup');
  }

  if (!metadata.errorCodes.includes(400) && metadata.methods.includes('POST')) {
    suggestions.push('💡 Consider adding 400 Bad Request handling for invalid input');
  }

  return {
    success: true,
    metadata,
    consumers,
    message,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Format API metadata for display (Arabic/English)
 */
export function formatApiMetadata(
  metadata: ApiEndpointMetadata,
  language: 'ar' | 'en' = 'ar'
): string {
  const isArabic = language === 'ar';

  const lines: string[] = [];

  lines.push(isArabic ? '📡 API Endpoint:' : '📡 API Endpoint:');
  lines.push(`  URL: ${metadata.urlPath}`);
  lines.push(`  File: ${metadata.fsPath}`);
  lines.push('');

  lines.push(isArabic ? '🔧 Methods:' : '🔧 Methods:');
  lines.push(`  ${metadata.methods.join(', ')}`);
  lines.push('');

  lines.push(isArabic ? '🔐 المصادقة:' : '🔐 Authentication:');
  if (metadata.authHint === 'none') {
    lines.push(isArabic ? '  لا يوجد (عام)' : '  None (public)');
  } else {
    lines.push(`  ${metadata.authDetails || metadata.authHint}`);
  }
  lines.push('');

  if (metadata.validationHints.length > 0) {
    lines.push(isArabic ? '✅ التحقق:' : '✅ Validation:');
    lines.push(`  ${metadata.validationHints.join(', ')}`);
    lines.push('');
  }

  if (metadata.errorCodes.length > 0) {
    lines.push(isArabic ? '❌ رموز الخطأ:' : '❌ Error Codes:');
    lines.push(`  ${metadata.errorCodes.join(', ')}`);
    lines.push('');
  }

  if (metadata.isDynamic && metadata.dynamicParams) {
    lines.push(isArabic ? '🔀 معاملات ديناميكية:' : '🔀 Dynamic Params:');
    lines.push(`  ${metadata.dynamicParams.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Get security recommendations for an API
 */
export function getSecurityRecommendations(
  metadata: ApiEndpointMetadata,
  language: 'ar' | 'en' = 'ar'
): string[] {
  const isArabic = language === 'ar';
  const recommendations: string[] = [];

  // Auth recommendations
  if (metadata.authHint === 'none') {
    if (metadata.methods.some(m => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m))) {
      recommendations.push(
        isArabic
          ? '🔴 يجب إضافة مصادقة لعمليات الكتابة (POST/PUT/DELETE)'
          : '🔴 Add authentication for write operations (POST/PUT/DELETE)'
      );
    }
  }

  // Validation recommendations
  if (metadata.validationHints.length === 0) {
    if (metadata.methods.includes('POST') || metadata.methods.includes('PUT')) {
      recommendations.push(
        isArabic
          ? '🟡 أضف validation للمدخلات باستخدام zod أو yup'
          : '🟡 Add input validation using zod or yup'
      );
    }
  }

  // Error handling
  if (!metadata.errorCodes.includes(401) && metadata.authHint !== 'none') {
    recommendations.push(
      isArabic
        ? '🟡 أضف معالجة خطأ 401 للمستخدمين غير المصرح لهم'
        : '🟡 Add 401 error handling for unauthorized users'
    );
  }

  if (!metadata.errorCodes.includes(500)) {
    recommendations.push(
      isArabic
        ? '🟢 فكر في إضافة معالجة خطأ 500 للأخطاء الداخلية'
        : '🟢 Consider adding 500 error handling for internal errors'
    );
  }

  return recommendations;
}

export default {
  inspectApiEndpoint,
  inferApiMetadata,
  walkProjectForConsumers,
  formatApiMetadata,
  getSecurityRecommendations,
};
