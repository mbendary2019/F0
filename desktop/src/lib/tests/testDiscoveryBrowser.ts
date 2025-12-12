// desktop/src/lib/tests/testDiscoveryBrowser.ts
// Phase 130.1: Browser-safe Test Discovery (uses IPC or localStorage)

import type {
  TestFramework,
  TestSuite,
  TestScope,
  FileTestMapping,
  TestMeta,
  FrameworkDetection,
  PackageTestScripts,
} from './testTypes';

/**
 * Check if we're in Electron renderer with IPC available
 * Phase 130.6: Updated to use f0Desktop API
 */
function hasIPC(): boolean {
  return typeof window !== 'undefined' &&
         'f0Desktop' in window &&
         typeof (window as any).f0Desktop?.readFile === 'function';
}

/**
 * Read file via IPC or return null
 * Phase 130.6: Updated to use f0Desktop API
 */
async function readFileViaIPC(filePath: string): Promise<string | null> {
  if (!hasIPC()) {
    return null;
  }

  try {
    const api = (window as any).f0Desktop;
    return await api.readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Check if file exists via IPC
 * Phase 130.6: Updated to use f0Desktop API with dedicated fileExists
 */
async function fileExistsViaIPC(filePath: string): Promise<boolean> {
  if (!hasIPC()) {
    return false;
  }

  try {
    const api = (window as any).f0Desktop;
    if (api.fileExists) {
      return await api.fileExists(filePath);
    }
    // Fallback: try to read and check if it works
    const content = await api.readFile(filePath);
    return content !== null;
  } catch {
    return false;
  }
}

/**
 * Detect test framework from package.json (browser-safe)
 */
export async function detectFramework(projectRoot: string): Promise<FrameworkDetection[]> {
  const detections: FrameworkDetection[] = [];

  // Try to read package.json
  const pkgPath = `${projectRoot}/package.json`;
  const pkgContent = await readFileViaIPC(pkgPath);

  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Check for frameworks in dependencies
      if (deps.jest) {
        detections.push({
          framework: 'jest',
          confidence: 0.8,
          command: 'npx jest',
        });
      }
      if (deps.vitest) {
        detections.push({
          framework: 'vitest',
          confidence: 0.85,
          command: 'npx vitest run',
        });
      }
      if (deps['@playwright/test'] || deps.playwright) {
        detections.push({
          framework: 'playwright',
          confidence: 0.8,
          command: 'npx playwright test',
        });
      }
      if (deps.cypress) {
        detections.push({
          framework: 'cypress',
          confidence: 0.8,
          command: 'npx cypress run',
        });
      }
      if (deps.mocha) {
        detections.push({
          framework: 'mocha',
          confidence: 0.7,
          command: 'npx mocha',
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  // If no IPC, return simulated detection based on common patterns
  if (detections.length === 0 && !hasIPC()) {
    // Return a default for dev/demo purposes
    detections.push({
      framework: 'jest',
      confidence: 0.5,
      command: 'npm test',
    });
  }

  return detections.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Parse test scripts from package.json (browser-safe)
 */
export async function parseTestScripts(projectRoot: string): Promise<PackageTestScripts> {
  const pkgPath = `${projectRoot}/package.json`;
  const pkgContent = await readFileViaIPC(pkgPath);

  if (!pkgContent) {
    // Return simulated scripts for demo
    return {
      test: 'jest',
    };
  }

  try {
    const pkg = JSON.parse(pkgContent);
    const scripts = pkg.scripts || {};
    const testScripts: PackageTestScripts = {};

    for (const [name, command] of Object.entries(scripts)) {
      if (name.includes('test') || name.includes('spec')) {
        testScripts[name] = command as string;
      }
    }

    return testScripts;
  } catch {
    return {};
  }
}

/**
 * Infer scope from script name
 */
function inferScope(scriptName: string): TestScope {
  if (scriptName.includes('e2e') || scriptName.includes('playwright') || scriptName.includes('cypress')) {
    return 'e2e';
  }
  if (scriptName.includes('integration') || scriptName.includes('int')) {
    return 'integration';
  }
  if (scriptName.includes('unit')) {
    return 'unit';
  }
  return 'all';
}

/**
 * Infer framework from command
 */
function inferFrameworkFromCommand(command: string): TestFramework {
  if (command.includes('jest')) return 'jest';
  if (command.includes('vitest')) return 'vitest';
  if (command.includes('playwright')) return 'playwright';
  if (command.includes('cypress')) return 'cypress';
  if (command.includes('mocha')) return 'mocha';
  return 'unknown';
}

/**
 * Format suite name for display
 */
function formatSuiteName(scriptName: string): string {
  const parts = scriptName.split(':');
  if (parts.length === 1) {
    return 'All Tests';
  }
  const suffix = parts[parts.length - 1];
  return suffix.charAt(0).toUpperCase() + suffix.slice(1) + ' Tests';
}

/**
 * Estimate duration based on scope
 */
function estimateDuration(scope: TestScope): number {
  switch (scope) {
    case 'unit': return 15000;
    case 'integration': return 45000;
    case 'e2e': return 120000;
    default: return 30000;
  }
}

/**
 * Discover all test suites in a project (browser-safe)
 */
export async function discoverTestSuites(projectRoot: string): Promise<TestSuite[]> {
  const suites: TestSuite[] = [];
  const detections = await detectFramework(projectRoot);
  const testScripts = await parseTestScripts(projectRoot);

  // Create suites from package.json scripts
  for (const [name, command] of Object.entries(testScripts)) {
    if (!command) continue;

    const scope = inferScope(name);
    let framework = inferFrameworkFromCommand(command);

    // Use detected framework if unknown
    if (framework === 'unknown' && detections.length > 0) {
      framework = detections[0].framework;
    }

    suites.push({
      id: `suite-${name}`,
      name: formatSuiteName(name),
      framework,
      command: `npm run ${name}`,
      scope,
      estimatedDurationMs: estimateDuration(scope),
    });
  }

  // If no scripts found but framework detected, create default suite
  if (suites.length === 0 && detections.length > 0) {
    const primary = detections[0];
    suites.push({
      id: 'suite-default',
      name: 'Default Tests',
      framework: primary.framework,
      command: primary.command || 'npm test',
      scope: 'all',
      configFile: primary.configFile,
      estimatedDurationMs: 30000,
    });
  }

  return suites;
}

/**
 * Build file-to-test mapping using project index (browser-safe)
 * Phase 133.4: Uses f0Desktop.getProjectIndex to discover source files and match with test files
 */
export async function buildFileTestMap(projectRoot: string): Promise<FileTestMapping[]> {
  const mappings: FileTestMapping[] = [];

  // Check if we have f0Desktop API with project index
  if (!hasIPC()) {
    console.log('[TestDiscovery] No IPC available, returning empty file map');
    return [];
  }

  try {
    const api = (window as any).f0Desktop;
    if (!api.getProjectIndex) {
      console.log('[TestDiscovery] getProjectIndex not available');
      return [];
    }

    // Get the project index
    const projectIndex = await api.getProjectIndex(projectRoot);
    if (!projectIndex || !projectIndex.files) {
      console.log('[TestDiscovery] No project index found');
      return [];
    }

    console.log('[TestDiscovery] Got project index with', projectIndex.files.length, 'files');

    // Separate source files and test files
    const sourceFiles: string[] = [];
    const testFiles: string[] = [];

    for (const file of projectIndex.files) {
      const relativePath = file.relativePath;

      // Skip non-code files
      if (!['ts', 'tsx', 'js', 'jsx'].includes(file.ext)) {
        continue;
      }

      // Check if it's a test file
      if (
        relativePath.includes('.test.') ||
        relativePath.includes('.spec.') ||
        relativePath.includes('__tests__/') ||
        relativePath.includes('__test__/')
      ) {
        testFiles.push(relativePath);
      } else {
        // It's a source file
        sourceFiles.push(relativePath);
      }
    }

    console.log('[TestDiscovery] Found', sourceFiles.length, 'source files and', testFiles.length, 'test files');

    // Build mappings: for each source file, find corresponding test files
    for (const sourcePath of sourceFiles) {
      // Get the base name without extension
      const parts = sourcePath.split('/');
      const fileName = parts[parts.length - 1];
      const baseName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');
      const dirPath = parts.slice(0, -1).join('/');

      // Look for test files that match this source
      const matchingTests: string[] = [];

      for (const testPath of testFiles) {
        // Check patterns:
        // 1. ComponentName.test.tsx or ComponentName.spec.tsx in same dir
        // 2. __tests__/ComponentName.test.tsx in parent dir
        // 3. ComponentName.test.tsx anywhere with same base name

        const testFileName = testPath.split('/').pop() || '';
        const testBaseName = testFileName
          .replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, '')
          .replace(/\.(ts|tsx|js|jsx)$/, '');

        if (testBaseName === baseName) {
          matchingTests.push(testPath);
        }
      }

      // Add mapping if tests were found
      if (matchingTests.length > 0) {
        mappings.push({
          sourcePath,
          testFiles: matchingTests,
        });
      }
    }

    // Also track files with no test coverage
    const coveredSources = new Set(mappings.map(m => m.sourcePath));
    for (const sourcePath of sourceFiles) {
      if (!coveredSources.has(sourcePath)) {
        // Add mapping with empty testFiles to indicate no coverage
        mappings.push({
          sourcePath,
          testFiles: [],
        });
      }
    }

    console.log('[TestDiscovery] Built', mappings.length, 'file mappings');
    return mappings;
  } catch (err) {
    console.error('[TestDiscovery] Error building file map:', err);
    return [];
  }
}

/**
 * Find tests for affected files
 */
export function findTestsForFiles(
  changedFiles: string[],
  fileTestMap: FileTestMapping[]
): string[] {
  const testFiles = new Set<string>();

  for (const changedFile of changedFiles) {
    const normalized = changedFile.replace(/\\/g, '/');

    // Check direct mapping
    const mapping = fileTestMap.find(m =>
      m.sourcePath === normalized ||
      normalized.endsWith(m.sourcePath)
    );

    if (mapping) {
      mapping.testFiles.forEach(t => testFiles.add(t));
    }

    // Check if changed file is itself a test
    if (normalized.includes('.test.') || normalized.includes('.spec.')) {
      testFiles.add(normalized);
    }
  }

  return Array.from(testFiles);
}

/**
 * Load test meta from localStorage
 */
export function loadTestMeta(projectRoot: string): TestMeta | null {
  try {
    const key = `f0-test-meta-${projectRoot.replace(/[^a-z0-9]/gi, '_')}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Save test meta to localStorage
 */
export function saveTestMeta(projectRoot: string, meta: TestMeta): void {
  try {
    const key = `f0-test-meta-${projectRoot.replace(/[^a-z0-9]/gi, '_')}`;
    localStorage.setItem(key, JSON.stringify(meta));
  } catch {
    // Ignore errors
  }
}

/**
 * Discover and cache test meta
 */
export async function discoverAndCacheTests(projectRoot: string): Promise<TestMeta> {
  console.log('[TestDiscovery] Discovering tests for:', projectRoot);

  const suites = await discoverTestSuites(projectRoot);
  const fileTestMap = await buildFileTestMap(projectRoot);
  const detections = await detectFramework(projectRoot);

  const meta: TestMeta = {
    projectRoot,
    detectedAt: new Date().toISOString(),
    suites,
    fileTestMap,
    defaultFramework: detections[0]?.framework,
    hasTests: suites.length > 0,
  };

  saveTestMeta(projectRoot, meta);
  console.log('[TestDiscovery] Found', suites.length, 'test suites');

  return meta;
}

/**
 * Get or discover test meta
 */
export async function getTestMeta(projectRoot: string, forceRefresh = false): Promise<TestMeta> {
  if (!forceRefresh) {
    const cached = loadTestMeta(projectRoot);
    if (cached) {
      // Check if cache is less than 1 hour old
      const cacheAge = Date.now() - new Date(cached.detectedAt).getTime();
      if (cacheAge < 60 * 60 * 1000) {
        return cached;
      }
    }
  }

  return discoverAndCacheTests(projectRoot);
}

