// desktop/src/lib/snapshot/routesDiscovery.ts
// Phase 124.2: Routes & API Discovery Engine
// Discovers all pages, layouts, and API routes from the project index

/**
 * Route information structure
 */
export interface RouteInfo {
  kind: 'page' | 'layout' | 'api' | 'loading' | 'error' | 'not-found';
  path: string;              // URL path like "/developers/billing"
  file: string;              // File path like "src/app/developers/billing/page.tsx"
  segmentType: 'static' | 'dynamic' | 'catchAll' | 'optionalCatchAll';
  dynamicSegments?: string[]; // e.g., ["id", "slug"]
  methods?: string[];        // For APIs: ["GET", "POST"]
}

/**
 * Routes discovery result
 */
export interface RoutesDiscoveryResult {
  pages: RouteInfo[];
  apiRoutes: RouteInfo[];
  layouts: RouteInfo[];
  loadingFiles: RouteInfo[];
  errorFiles: RouteInfo[];
  totalRoutes: number;
}

/**
 * Routes summary stats for UI display
 */
export interface RoutesStats {
  pageCount: number;
  apiCount: number;
  layoutCount: number;
  dynamicRouteCount: number;
}

/**
 * Index file type (matches indexer structure)
 */
interface IndexFile {
  relativePath?: string;
  path?: string;
  ext?: string;
  name?: string;
}

/**
 * Patterns to identify Next.js app router files
 */
const PAGE_FILE_PATTERNS = [
  /page\.(tsx?|jsx?)$/,
];

const LAYOUT_FILE_PATTERNS = [
  /layout\.(tsx?|jsx?)$/,
];

const API_ROUTE_PATTERNS = [
  /route\.(tsx?|jsx?)$/,
];

const LOADING_PATTERNS = [
  /loading\.(tsx?|jsx?)$/,
];

const ERROR_PATTERNS = [
  /error\.(tsx?|jsx?)$/,
  /not-found\.(tsx?|jsx?)$/,
];

/**
 * Common app directory patterns
 * Supports multiple project structures
 */
const APP_DIR_PATTERNS = [
  /^src\/app\//,
  /^app\//,
  /^apps\/web\/app\//,
  /^packages\/web\/app\//,
];

/**
 * Check if file is in an app directory
 */
function isInAppDir(filePath: string): boolean {
  return APP_DIR_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Get the app dir prefix for a file path
 */
function getAppDirPrefix(filePath: string): string | null {
  for (const pattern of APP_DIR_PATTERNS) {
    const match = filePath.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * Determine segment type from path segment
 */
function getSegmentType(segment: string): {
  type: 'static' | 'dynamic' | 'catchAll' | 'optionalCatchAll';
  name?: string;
} {
  // Optional catch-all: [[...slug]]
  if (/^\[\[\.\.\..+\]\]$/.test(segment)) {
    const name = segment.slice(5, -2); // Remove [[... and ]]
    return { type: 'optionalCatchAll', name };
  }

  // Catch-all: [...slug]
  if (/^\[\.\.\..+\]$/.test(segment)) {
    const name = segment.slice(4, -1); // Remove [... and ]
    return { type: 'catchAll', name };
  }

  // Dynamic: [id]
  if (/^\[.+\]$/.test(segment)) {
    const name = segment.slice(1, -1); // Remove [ and ]
    return { type: 'dynamic', name };
  }

  // Route groups: (group) - skip in URL
  if (/^\(.+\)$/.test(segment)) {
    return { type: 'static' };
  }

  // Static segment
  return { type: 'static' };
}

/**
 * Convert file path to URL route path
 * Example: "src/app/developers/billing/page.tsx" → "/developers/billing"
 */
function filePathToRoutePath(filePath: string): {
  routePath: string;
  segmentType: 'static' | 'dynamic' | 'catchAll' | 'optionalCatchAll';
  dynamicSegments: string[];
} {
  const appDirPrefix = getAppDirPrefix(filePath);
  if (!appDirPrefix) {
    return { routePath: '/', segmentType: 'static', dynamicSegments: [] };
  }

  // Remove app dir prefix and file name
  let routePart = filePath.slice(appDirPrefix.length);

  // Remove file name (page.tsx, route.ts, layout.tsx, etc.)
  const lastSlash = routePart.lastIndexOf('/');
  if (lastSlash >= 0) {
    routePart = routePart.slice(0, lastSlash);
  } else {
    routePart = '';
  }

  // Process segments
  const segments = routePart.split('/').filter(s => s.length > 0);
  const dynamicSegments: string[] = [];
  let overallSegmentType: 'static' | 'dynamic' | 'catchAll' | 'optionalCatchAll' = 'static';

  const urlSegments: string[] = [];

  for (const segment of segments) {
    const { type, name } = getSegmentType(segment);

    // Route groups don't appear in URL
    if (/^\(.+\)$/.test(segment)) {
      continue;
    }

    // Track dynamic segments
    if (name) {
      dynamicSegments.push(name);
    }

    // Update overall segment type (most specific wins)
    if (type === 'optionalCatchAll') {
      overallSegmentType = 'optionalCatchAll';
    } else if (type === 'catchAll' && overallSegmentType !== 'optionalCatchAll') {
      overallSegmentType = 'catchAll';
    } else if (type === 'dynamic' && overallSegmentType === 'static') {
      overallSegmentType = 'dynamic';
    }

    urlSegments.push(segment);
  }

  const routePath = '/' + urlSegments.join('/');

  return {
    routePath: routePath === '/' ? '/' : routePath,
    segmentType: overallSegmentType,
    dynamicSegments,
  };
}

/**
 * Check if file is an API route file
 */
function isApiRoute(filePath: string): boolean {
  return filePath.includes('/api/') && API_ROUTE_PATTERNS.some(p => p.test(filePath));
}

/**
 * Read file content via f0Desktop bridge
 */
async function readFileContent(
  projectRoot: string,
  filePath: string
): Promise<string | null> {
  if (typeof window !== 'undefined' && (window as any).f0Desktop?.readFile) {
    try {
      const fullPath = filePath.startsWith(projectRoot)
        ? filePath
        : `${projectRoot}/${filePath}`;
      return await (window as any).f0Desktop.readFile(fullPath);
    } catch (err) {
      console.warn('[routesDiscovery] readFile error for', filePath, err);
      return null;
    }
  }
  return null;
}

/**
 * Extract HTTP methods from API route file content
 * Looks for: export async function GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS
 */
function extractApiMethods(content: string): string[] {
  const methods: string[] = [];
  const methodPatterns = [
    /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(/g,
    /export\s+const\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*=/g,
  ];

  for (const pattern of methodPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const method = match[2] || match[1];
      if (method && !methods.includes(method)) {
        methods.push(method);
      }
    }
  }

  return methods.sort();
}

/**
 * Discover all routes from project index
 */
export async function discoverRoutes(
  projectRoot: string,
  index: { files: Array<IndexFile> }
): Promise<RoutesDiscoveryResult> {
  console.log('[routesDiscovery] Starting routes discovery...');

  const pages: RouteInfo[] = [];
  const apiRoutes: RouteInfo[] = [];
  const layouts: RouteInfo[] = [];
  const loadingFiles: RouteInfo[] = [];
  const errorFiles: RouteInfo[] = [];

  // Filter files in app directories
  const appFiles = index.files.filter(f => {
    const filePath = f.relativePath || f.path;
    return filePath && typeof filePath === 'string' && isInAppDir(filePath);
  });

  console.log(`[routesDiscovery] Found ${appFiles.length} files in app directories`);

  for (const file of appFiles) {
    const filePath = (file.relativePath || file.path) as string;
    const fileName = filePath.split('/').pop() || '';

    // Skip non-route files
    const isPage = PAGE_FILE_PATTERNS.some(p => p.test(fileName));
    const isLayout = LAYOUT_FILE_PATTERNS.some(p => p.test(fileName));
    const isApiRoute = filePath.includes('/api/') && API_ROUTE_PATTERNS.some(p => p.test(fileName));
    const isLoading = LOADING_PATTERNS.some(p => p.test(fileName));
    const isError = ERROR_PATTERNS.some(p => p.test(fileName));

    if (!isPage && !isLayout && !isApiRoute && !isLoading && !isError) {
      continue;
    }

    const { routePath, segmentType, dynamicSegments } = filePathToRoutePath(filePath);

    // Handle API routes - need to extract methods
    if (isApiRoute) {
      let methods: string[] = ['GET']; // Default assumption

      // Try to read file and extract methods
      const content = await readFileContent(projectRoot, filePath);
      if (content) {
        const extractedMethods = extractApiMethods(content);
        if (extractedMethods.length > 0) {
          methods = extractedMethods;
        }
      }

      apiRoutes.push({
        kind: 'api',
        path: routePath,
        file: filePath,
        segmentType,
        dynamicSegments: dynamicSegments.length > 0 ? dynamicSegments : undefined,
        methods,
      });
      continue;
    }

    // Handle pages
    if (isPage) {
      pages.push({
        kind: 'page',
        path: routePath,
        file: filePath,
        segmentType,
        dynamicSegments: dynamicSegments.length > 0 ? dynamicSegments : undefined,
      });
      continue;
    }

    // Handle layouts
    if (isLayout) {
      layouts.push({
        kind: 'layout',
        path: routePath,
        file: filePath,
        segmentType,
        dynamicSegments: dynamicSegments.length > 0 ? dynamicSegments : undefined,
      });
      continue;
    }

    // Handle loading files
    if (isLoading) {
      loadingFiles.push({
        kind: 'loading',
        path: routePath,
        file: filePath,
        segmentType,
      });
      continue;
    }

    // Handle error files
    if (isError) {
      const kind = fileName.includes('not-found') ? 'not-found' : 'error';
      errorFiles.push({
        kind,
        path: routePath,
        file: filePath,
        segmentType,
      });
    }
  }

  // Sort by path
  pages.sort((a, b) => a.path.localeCompare(b.path));
  apiRoutes.sort((a, b) => a.path.localeCompare(b.path));
  layouts.sort((a, b) => a.path.localeCompare(b.path));

  const result: RoutesDiscoveryResult = {
    pages,
    apiRoutes,
    layouts,
    loadingFiles,
    errorFiles,
    totalRoutes: pages.length + apiRoutes.length,
  };

  console.log(`[routesDiscovery] Complete: ${pages.length} pages, ${apiRoutes.length} APIs, ${layouts.length} layouts`);

  return result;
}

/**
 * Get routes summary stats for UI
 */
export function getRoutesStats(result: RoutesDiscoveryResult): RoutesStats {
  const dynamicRouteCount = [
    ...result.pages,
    ...result.apiRoutes,
  ].filter(r => r.segmentType !== 'static').length;

  return {
    pageCount: result.pages.length,
    apiCount: result.apiRoutes.length,
    layoutCount: result.layouts.length,
    dynamicRouteCount,
  };
}

/**
 * Find route by URL path
 */
export function findRouteByPath(
  result: RoutesDiscoveryResult,
  urlPath: string
): RouteInfo | null {
  // Exact match first
  const exactPage = result.pages.find(r => r.path === urlPath);
  if (exactPage) return exactPage;

  const exactApi = result.apiRoutes.find(r => r.path === urlPath);
  if (exactApi) return exactApi;

  // TODO: Dynamic route matching
  return null;
}

/**
 * Find routes containing a search term
 */
export function searchRoutes(
  result: RoutesDiscoveryResult,
  query: string
): RouteInfo[] {
  const lowerQuery = query.toLowerCase();

  return [
    ...result.pages,
    ...result.apiRoutes,
    ...result.layouts,
  ].filter(r =>
    r.path.toLowerCase().includes(lowerQuery) ||
    r.file.toLowerCase().includes(lowerQuery)
  );
}

export default discoverRoutes;
