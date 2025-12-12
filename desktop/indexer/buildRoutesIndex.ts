// desktop/indexer/buildRoutesIndex.ts
// Phase 124.3: Build Routes Index for Smart Route-Aware Agent
// Generates .f0/index/routes-index.json from project-index.json

import * as fs from 'fs';
import * as path from 'path';
import type {
  IndexedRoute,
  RoutesIndex,
  RouteKind,
  ProjectIndex,
} from './types';
import { ROUTE_SEMANTIC_TAGS } from './types';

/**
 * App directory patterns (same as routesDiscovery.ts)
 */
const APP_DIR_PATTERNS = [
  /^src\/app\//,
  /^app\//,
  /^apps\/web\/app\//,
  /^packages\/web\/app\//,
];

/**
 * File patterns for pages and API routes
 */
const PAGE_FILE_PATTERN = /page\.(tsx?|jsx?)$/;
const API_ROUTE_PATTERN = /route\.(tsx?|jsx?)$/;

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
 * Extract locale-agnostic path (removes [locale] segment)
 */
function getLocaleAgnosticPath(urlPath: string): string {
  // Remove [locale] or locale segments like /en/, /ar/
  return urlPath
    .replace(/\/\[locale\]/g, '')
    .replace(/^\/(en|ar|de|fr|es|zh|ja|ko)\//g, '/')
    .replace(/^\/\[locale\]/, '')
    || '/';
}

/**
 * Extract route group from path (e.g., "(app)" -> "app")
 */
function extractRouteGroup(filePath: string): string | undefined {
  const groupMatch = filePath.match(/\/\(([^)]+)\)\//);
  return groupMatch ? groupMatch[1] : undefined;
}

/**
 * Generate semantic tags for a route based on its path
 */
function generateSemanticTags(urlPath: string, fsPath: string): string[] {
  const tags: string[] = [];
  const segments = urlPath.split('/').filter(s => s && !s.startsWith('['));

  // Add path segments as tags
  for (const segment of segments) {
    tags.push(segment.toLowerCase());

    // Look up semantic synonyms
    const synonyms = ROUTE_SEMANTIC_TAGS[segment.toLowerCase()];
    if (synonyms) {
      tags.push(...synonyms);
    }
  }

  // Add file path segments
  const fsSegments = fsPath.split('/').filter(s =>
    s &&
    !s.startsWith('[') &&
    !s.startsWith('(') &&
    !['src', 'app', 'api', 'page.tsx', 'page.ts', 'route.tsx', 'route.ts'].includes(s)
  );

  for (const segment of fsSegments) {
    const cleanSegment = segment.replace(/\.(tsx?|jsx?)$/, '').toLowerCase();
    if (cleanSegment && !tags.includes(cleanSegment)) {
      tags.push(cleanSegment);

      // Look up semantic synonyms
      const synonyms = ROUTE_SEMANTIC_TAGS[cleanSegment];
      if (synonyms) {
        tags.push(...synonyms.filter(s => !tags.includes(s)));
      }
    }
  }

  // Deduplicate
  return [...new Set(tags)];
}

/**
 * Convert file path to URL route path
 */
function filePathToUrlPath(filePath: string): {
  urlPath: string;
  segments: string[];
  isDynamic: boolean;
} {
  const appDirPrefix = getAppDirPrefix(filePath);
  if (!appDirPrefix) {
    return { urlPath: '/', segments: [], isDynamic: false };
  }

  // Remove app dir prefix and file name
  let routePart = filePath.slice(appDirPrefix.length);

  // Remove file name (page.tsx, route.ts, etc.)
  const lastSlash = routePart.lastIndexOf('/');
  if (lastSlash >= 0) {
    routePart = routePart.slice(0, lastSlash);
  } else {
    routePart = '';
  }

  // Process segments
  const pathSegments = routePart.split('/').filter(s => s.length > 0);
  const urlSegments: string[] = [];
  const cleanSegments: string[] = [];
  let isDynamic = false;

  for (const segment of pathSegments) {
    // Route groups don't appear in URL
    if (/^\(.+\)$/.test(segment)) {
      continue;
    }

    // Check for dynamic segments
    if (/^\[/.test(segment)) {
      isDynamic = true;
    }

    urlSegments.push(segment);

    // Clean segment for matching (remove brackets)
    const cleanSegment = segment
      .replace(/^\[\[?\.\.\./, '')
      .replace(/\]?\]$/, '')
      .replace(/^\[/, '')
      .replace(/\]$/, '');
    if (cleanSegment) {
      cleanSegments.push(cleanSegment.toLowerCase());
    }
  }

  const urlPath = '/' + urlSegments.join('/');

  return {
    urlPath: urlPath === '/' ? '/' : urlPath,
    segments: cleanSegments,
    isDynamic,
  };
}

/**
 * Extract HTTP methods from API route file content
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
 * Build routes index from project index
 */
export async function buildRoutesIndex(
  projectRoot: string,
  projectIndex: ProjectIndex
): Promise<RoutesIndex> {
  console.log('[buildRoutesIndex] Building routes index...');

  const routes: IndexedRoute[] = [];
  let pageCount = 0;
  let apiCount = 0;
  let dynamicCount = 0;

  // Filter files in app directories
  const appFiles = projectIndex.files.filter(f => {
    const filePath = f.relativePath;
    return filePath && isInAppDir(filePath);
  });

  console.log(`[buildRoutesIndex] Found ${appFiles.length} files in app directories`);

  for (const file of appFiles) {
    const filePath = file.relativePath;
    const fileName = filePath.split('/').pop() || '';

    // Check if this is a page or API route
    const isPage = PAGE_FILE_PATTERN.test(fileName);
    const isApiRoute = filePath.includes('/api/') && API_ROUTE_PATTERN.test(fileName);

    if (!isPage && !isApiRoute) {
      continue;
    }

    const { urlPath, segments, isDynamic } = filePathToUrlPath(filePath);
    const localeAgnosticPath = getLocaleAgnosticPath(urlPath);
    const tags = generateSemanticTags(urlPath, filePath);
    const group = extractRouteGroup(filePath);

    const kind: RouteKind = isApiRoute ? 'api' : 'page';

    const route: IndexedRoute = {
      kind,
      fsPath: filePath,
      urlPath,
      localeAgnosticPath,
      segments,
      tags,
      isDynamic: isDynamic || undefined,
      group,
    };

    // For API routes, try to extract methods
    if (isApiRoute) {
      const fullPath = path.join(projectRoot, filePath);
      try {
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const methods = extractApiMethods(content);
          if (methods.length > 0) {
            route.methods = methods;
          }
        }
      } catch (err) {
        // Ignore read errors, just don't add methods
      }
      apiCount++;
    } else {
      pageCount++;
    }

    if (isDynamic) {
      dynamicCount++;
    }

    routes.push(route);
  }

  // Sort routes by path
  routes.sort((a, b) => a.urlPath.localeCompare(b.urlPath));

  const routesIndex: RoutesIndex = {
    version: 1,
    indexedAt: Date.now(),
    projectRoot,
    routes,
    stats: {
      pageCount,
      apiCount,
      dynamicCount,
    },
  };

  console.log(`[buildRoutesIndex] Complete: ${pageCount} pages, ${apiCount} APIs, ${dynamicCount} dynamic`);

  return routesIndex;
}

/**
 * Save routes index to file
 */
export function saveRoutesIndex(
  projectRoot: string,
  routesIndex: RoutesIndex
): void {
  const indexDir = path.join(projectRoot, '.f0', 'index');
  const indexPath = path.join(indexDir, 'routes-index.json');

  // Ensure directory exists
  if (!fs.existsSync(indexDir)) {
    fs.mkdirSync(indexDir, { recursive: true });
  }

  // Write index
  fs.writeFileSync(indexPath, JSON.stringify(routesIndex, null, 2));
  console.log(`[buildRoutesIndex] Saved to ${indexPath}`);
}

/**
 * Load routes index from file
 */
export function loadRoutesIndex(projectRoot: string): RoutesIndex | null {
  const indexPath = path.join(projectRoot, '.f0', 'index', 'routes-index.json');

  try {
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return JSON.parse(content) as RoutesIndex;
    }
  } catch (err) {
    console.error('[buildRoutesIndex] Error loading routes index:', err);
  }

  return null;
}

/**
 * CLI entry point
 */
async function main() {
  const projectRoot = process.argv[2] || process.cwd();

  console.log(`Building routes index for: ${projectRoot}`);

  // Load project index
  const projectIndexPath = path.join(projectRoot, '.f0', 'index', 'project-index.json');

  if (!fs.existsSync(projectIndexPath)) {
    console.error('Error: project-index.json not found. Run project indexer first.');
    process.exit(1);
  }

  const projectIndex = JSON.parse(
    fs.readFileSync(projectIndexPath, 'utf-8')
  ) as ProjectIndex;

  // Build routes index
  const routesIndex = await buildRoutesIndex(projectRoot, projectIndex);

  // Save to file
  saveRoutesIndex(projectRoot, routesIndex);

  console.log('\n✅ Routes index built successfully!');
  console.log(`   Pages: ${routesIndex.stats.pageCount}`);
  console.log(`   APIs: ${routesIndex.stats.apiCount}`);
  console.log(`   Dynamic: ${routesIndex.stats.dynamicCount}`);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export default buildRoutesIndex;
