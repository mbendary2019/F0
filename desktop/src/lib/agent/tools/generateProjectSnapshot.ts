// desktop/src/lib/agent/tools/generateProjectSnapshot.ts
// Phase 123: Generate Project Snapshot Tool
// Phase 124.1: Added Dependency Graph integration
// Phase 124.2: Added Routes & API Discovery
// Analyzes project files and generates a structured JSON snapshot

import { buildSnapshotPrompt } from '../prompts/snapshotPrompt';
import {
  buildDependencyGraph,
  getDependencyStats,
  type DependencyGraph,
  type DependencyStats,
} from '../../snapshot/dependencyGraph';
import {
  discoverRoutes,
  getRoutesStats,
  type RouteInfo,
  type RoutesDiscoveryResult,
  type RoutesStats,
} from '../../snapshot/routesDiscovery';

/**
 * Project snapshot structure (v3 with dependencies + routes)
 */
export interface ProjectSnapshot {
  projectName: string;
  stack: string[];
  authFlow: string;
  billingFlow: string;
  routes: string[];              // Legacy: simple route strings
  apis: string[];                // Legacy: simple API strings
  stateManagement: string[];
  database: string;
  styling: string;
  importantFiles: string[];
  features: string[];
  notes: string[];
  generatedAt: string;
  // Phase 124.1: Dependency Graph
  dependencyStats?: DependencyStats;
  dependencyGraph?: DependencyGraph;
  // Phase 124.2: Routes Discovery
  routesInfo?: RouteInfo[];      // Detailed page routes
  apiRoutesInfo?: RouteInfo[];   // Detailed API routes
  layoutsInfo?: RouteInfo[];     // Layout files
  routesStats?: RoutesStats;     // Summary stats
}

// Re-export for convenience
export type { DependencyGraph, DependencyStats, RouteInfo, RoutesStats };

/**
 * File patterns to prioritize for snapshot generation
 */
const IMPORTANT_FILE_PATTERNS = [
  // Auth related
  /auth/i,
  /login/i,
  /signup|sign-up|register/i,
  /session/i,

  // Billing/Payment
  /billing/i,
  /payment/i,
  /checkout/i,
  /subscription/i,
  /stripe/i,

  // API/Routes
  /api\//i,
  /route\.ts/i,
  /endpoint/i,

  // Core files
  /page\.tsx?$/i,
  /layout\.tsx?$/i,
  /middleware\.ts/i,

  // Config
  /config/i,
  /\.env/i,
  /firebase/i,
  /next\.config/i,
  /package\.json$/i,
  /tsconfig\.json$/i,

  // State management
  /store/i,
  /context/i,
  /provider/i,
  /zustand|redux|recoil/i,

  // Database
  /firestore/i,
  /database/i,
  /prisma/i,
  /schema/i,
];

/**
 * Files to exclude from snapshot
 */
const EXCLUDE_PATTERNS = [
  /node_modules/i,
  /\.next/i,
  /\.git/i,
  /dist/i,
  /build/i,
  /\.lock$/i,
  /\.map$/i,
  /\.d\.ts$/i,
  /test|spec|__test__/i,
];

/**
 * LLM client interface for generating snapshot
 */
export interface SnapshotLLMClient {
  chat(messages: Array<{ role: string; content: string }>): Promise<string>;
}

/**
 * Options for snapshot generation
 */
export interface GenerateSnapshotOptions {
  projectRoot: string;
  locale?: 'ar' | 'en';
  maxFiles?: number;
  maxCharsPerFile?: number;
  // Phase 124.1: Dependency graph options
  includeDependencyGraph?: boolean;  // Include full graph (large)
  includeDependencyStats?: boolean;  // Include stats only (small)
  // Phase 124.2: Routes discovery options
  includeRoutesDiscovery?: boolean;  // Include detailed routes info (default: true)
}

/**
 * Get project index from f0Desktop bridge
 */
async function getProjectIndex(projectRoot: string): Promise<any | null> {
  const indexPath = `${projectRoot}/.f0/index/project-index.json`;

  // Try f0Desktop bridge first (renderer process)
  if (typeof window !== 'undefined' && (window as any).f0Desktop?.readFile) {
    try {
      const content = await (window as any).f0Desktop.readFile(indexPath);
      if (content) {
        return JSON.parse(content);
      }
    } catch (err) {
      console.warn('[generateProjectSnapshot] Failed to load index:', err);
    }
  }

  return null;
}

/**
 * Read file content via f0Desktop bridge
 */
async function readFileContent(filePath: string): Promise<string | null> {
  if (typeof window !== 'undefined' && (window as any).f0Desktop?.readFile) {
    try {
      return await (window as any).f0Desktop.readFile(filePath);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Score a file path for importance
 */
function scoreFilePath(filePath: string): number {
  let score = 0;

  // Check against important patterns
  for (const pattern of IMPORTANT_FILE_PATTERNS) {
    if (pattern.test(filePath)) {
      score += 10;
    }
  }

  // Boost for root-level files
  if (filePath.split('/').length <= 3) {
    score += 5;
  }

  // Boost for src/app files
  if (/src\/(app|pages|components)/.test(filePath)) {
    score += 3;
  }

  // Penalty for deep nesting
  const depth = filePath.split('/').length;
  if (depth > 6) {
    score -= depth - 6;
  }

  return score;
}

/**
 * Should exclude this file path
 */
function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Select important files from project index
 */
export function selectImportantFiles(
  index: { files: Array<{ path?: string; size?: number }> },
  maxFiles: number = 15
): string[] {
  if (!index?.files?.length) {
    return [];
  }

  // Score and sort files (filter out undefined paths first)
  const scoredFiles = index.files
    .filter(f => f.path && typeof f.path === 'string' && !shouldExclude(f.path))
    .map(f => ({
      path: f.path as string,
      score: scoreFilePath(f.path as string),
    }))
    .sort((a, b) => b.score - a.score);

  // Take top files
  return scoredFiles.slice(0, maxFiles).map(f => f.path);
}

/**
 * Generate a project snapshot using LLM analysis
 *
 * This is the main function that:
 * 1. Loads the project index
 * 2. Selects important files
 * 3. Reads file contents
 * 4. Builds prompt and calls LLM
 * 5. Parses and returns the snapshot
 */
export async function generateProjectSnapshot(
  llm: SnapshotLLMClient,
  options: GenerateSnapshotOptions
): Promise<ProjectSnapshot | null> {
  const {
    projectRoot,
    locale = 'ar',
    maxFiles = 15,
    maxCharsPerFile = 3000,
  } = options;

  console.log('[generateProjectSnapshot] Starting for:', projectRoot);

  // 1. Load project index
  const index = await getProjectIndex(projectRoot);
  if (!index?.files?.length) {
    console.warn('[generateProjectSnapshot] No index found');
    return null;
  }

  console.log('[generateProjectSnapshot] Index loaded, files:', index.files.length);

  // 2. Select important files
  const importantPaths = selectImportantFiles(index, maxFiles);
  console.log('[generateProjectSnapshot] Selected files:', importantPaths.length);

  // 3. Read file contents
  const filesWithContent: Array<{ path: string; content: string }> = [];

  for (const filePath of importantPaths) {
    const fullPath = `${projectRoot}/${filePath}`;
    const content = await readFileContent(fullPath);

    if (content) {
      filesWithContent.push({
        path: filePath,
        content: content.slice(0, maxCharsPerFile),
      });
    }
  }

  console.log('[generateProjectSnapshot] Files with content:', filesWithContent.length);

  if (filesWithContent.length === 0) {
    console.warn('[generateProjectSnapshot] No files could be read');
    return null;
  }

  // 4. Build prompt and call LLM
  const { system, user } = buildSnapshotPrompt(filesWithContent, locale);

  try {
    const response = await llm.chat([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);

    // 5. Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[generateProjectSnapshot] No JSON in response');
      return null;
    }

    const snapshot = JSON.parse(jsonMatch[0]) as ProjectSnapshot;
    snapshot.generatedAt = new Date().toISOString();

    console.log('[generateProjectSnapshot] Snapshot generated:', snapshot.projectName);

    return snapshot;
  } catch (err) {
    console.error('[generateProjectSnapshot] LLM/Parse error:', err);
    return null;
  }
}

/**
 * Generate snapshot without LLM (basic analysis only)
 * Useful for quick snapshots or when LLM is unavailable
 * Phase 124.1: Now includes dependency graph analysis
 * Phase 124.2: Now includes routes discovery
 */
export async function generateBasicSnapshot(
  options: GenerateSnapshotOptions
): Promise<Partial<ProjectSnapshot> | null> {
  const {
    projectRoot,
    includeDependencyGraph = false,
    includeDependencyStats = true, // Default: include stats
    includeRoutesDiscovery = true, // Default: include routes
  } = options;

  const index = await getProjectIndex(projectRoot);
  if (!index?.files?.length) {
    return null;
  }

  // Filter files with valid paths (support both relativePath and path)
  const validFiles = index.files.filter(
    (f: { relativePath?: string; path?: string }) => {
      const filePath = f.relativePath || f.path;
      return filePath && typeof filePath === 'string';
    }
  );

  // Get file paths for analysis
  const getFilePath = (f: { relativePath?: string; path?: string }) =>
    (f.relativePath || f.path) as string;

  // Infer stack from files
  const stack: string[] = [];
  const fileList = validFiles.map(getFilePath).join('\n');

  if (/next\.config/i.test(fileList)) stack.push('Next.js');
  if (/package\.json/i.test(fileList)) stack.push('Node.js');
  if (/\.tsx?$/i.test(fileList)) stack.push('TypeScript');
  if (/firebase/i.test(fileList)) stack.push('Firebase');
  if (/tailwind/i.test(fileList)) stack.push('Tailwind CSS');
  if (/prisma/i.test(fileList)) stack.push('Prisma');
  if (/stripe/i.test(fileList)) stack.push('Stripe');

  // Legacy: Find routes (simple file paths)
  const routes = validFiles
    .filter((f: { relativePath?: string; path?: string }) => /page\.tsx?$/.test(getFilePath(f)))
    .map(getFilePath)
    .slice(0, 10);

  // Legacy: Find APIs (simple file paths)
  const apis = validFiles
    .filter((f: { relativePath?: string; path?: string }) => /api\/.*route\.ts/.test(getFilePath(f)))
    .map(getFilePath)
    .slice(0, 10);

  // Phase 124.1: Build dependency graph
  let dependencyGraph: DependencyGraph | undefined;
  let dependencyStats: DependencyStats | undefined;

  if (includeDependencyGraph || includeDependencyStats) {
    try {
      console.log('[generateBasicSnapshot] Building dependency graph for:', projectRoot);
      console.log('[generateBasicSnapshot] Index has', index.files?.length, 'files');
      dependencyGraph = await buildDependencyGraph(projectRoot, index);

      if (dependencyGraph) {
        console.log('[generateBasicSnapshot] Graph returned:', {
          totalFiles: dependencyGraph.totalFiles,
          edges: dependencyGraph.edges,
          nodesCount: dependencyGraph.nodes?.length,
          orphansCount: dependencyGraph.orphans?.length,
          hubsCount: dependencyGraph.hubs?.length,
        });
        dependencyStats = getDependencyStats(dependencyGraph);
        console.log('[generateBasicSnapshot] Stats computed:', JSON.stringify(dependencyStats));
      } else {
        console.warn('[generateBasicSnapshot] buildDependencyGraph returned null/undefined');
      }
    } catch (err) {
      console.error('[generateBasicSnapshot] Failed to build dependency graph:', err);
    }
  } else {
    console.log('[generateBasicSnapshot] Skipping dependency graph (not requested)');
  }

  // Phase 124.2: Discover routes
  let routesResult: RoutesDiscoveryResult | undefined;
  let routesStats: RoutesStats | undefined;

  if (includeRoutesDiscovery) {
    try {
      console.log('[generateBasicSnapshot] Discovering routes for:', projectRoot);
      routesResult = await discoverRoutes(projectRoot, index);

      if (routesResult) {
        routesStats = getRoutesStats(routesResult);
        console.log('[generateBasicSnapshot] Routes discovered:', {
          pages: routesResult.pages.length,
          apis: routesResult.apiRoutes.length,
          layouts: routesResult.layouts.length,
        });
      }
    } catch (err) {
      console.error('[generateBasicSnapshot] Failed to discover routes:', err);
    }
  }

  const snapshot: Partial<ProjectSnapshot> = {
    projectName: projectRoot.split('/').pop() || 'Unknown',
    stack,
    routes,
    apis,
    importantFiles: selectImportantFiles(index, 10),
    generatedAt: new Date().toISOString(),
  };

  // Add dependency info
  if (dependencyStats) {
    snapshot.dependencyStats = dependencyStats;
  }
  if (includeDependencyGraph && dependencyGraph) {
    snapshot.dependencyGraph = dependencyGraph;
  }

  // Add routes info (Phase 124.2)
  if (routesResult) {
    snapshot.routesInfo = routesResult.pages;
    snapshot.apiRoutesInfo = routesResult.apiRoutes;
    snapshot.layoutsInfo = routesResult.layouts;
    snapshot.routesStats = routesStats;
  }

  return snapshot;
}

export default generateProjectSnapshot;
