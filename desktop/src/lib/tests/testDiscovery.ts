// desktop/src/lib/tests/testDiscovery.ts
// Phase 130.1: Test Discovery Layer

import * as fs from 'fs';
import * as path from 'path';
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
 * Detect test framework from config files
 */
export function detectFramework(projectRoot: string): FrameworkDetection[] {
  const detections: FrameworkDetection[] = [];

  // Jest detection
  const jestConfigs = [
    'jest.config.js',
    'jest.config.ts',
    'jest.config.mjs',
    'jest.config.json',
  ];
  for (const config of jestConfigs) {
    const configPath = path.join(projectRoot, config);
    if (fs.existsSync(configPath)) {
      detections.push({
        framework: 'jest',
        confidence: 0.9,
        configFile: config,
        command: 'npx jest',
      });
      break;
    }
  }

  // Vitest detection
  const vitestConfigs = [
    'vitest.config.js',
    'vitest.config.ts',
    'vitest.config.mjs',
  ];
  for (const config of vitestConfigs) {
    const configPath = path.join(projectRoot, config);
    if (fs.existsSync(configPath)) {
      detections.push({
        framework: 'vitest',
        confidence: 0.95,
        configFile: config,
        command: 'npx vitest run',
      });
      break;
    }
  }

  // Playwright detection
  const playwrightConfigs = [
    'playwright.config.js',
    'playwright.config.ts',
  ];
  for (const config of playwrightConfigs) {
    const configPath = path.join(projectRoot, config);
    if (fs.existsSync(configPath)) {
      detections.push({
        framework: 'playwright',
        confidence: 0.95,
        configFile: config,
        command: 'npx playwright test',
      });
      break;
    }
  }

  // Cypress detection
  const cypressConfigs = [
    'cypress.config.js',
    'cypress.config.ts',
    'cypress.json',
  ];
  for (const config of cypressConfigs) {
    const configPath = path.join(projectRoot, config);
    if (fs.existsSync(configPath)) {
      detections.push({
        framework: 'cypress',
        confidence: 0.95,
        configFile: config,
        command: 'npx cypress run',
      });
      break;
    }
  }

  // Mocha detection
  const mochaConfigs = ['.mocharc.js', '.mocharc.json', '.mocharc.yml'];
  for (const config of mochaConfigs) {
    const configPath = path.join(projectRoot, config);
    if (fs.existsSync(configPath)) {
      detections.push({
        framework: 'mocha',
        confidence: 0.85,
        configFile: config,
        command: 'npx mocha',
      });
      break;
    }
  }

  // Check package.json for hints
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.jest && !detections.find(d => d.framework === 'jest')) {
        detections.push({
          framework: 'jest',
          confidence: 0.7,
          command: 'npx jest',
        });
      }
      if (deps.vitest && !detections.find(d => d.framework === 'vitest')) {
        detections.push({
          framework: 'vitest',
          confidence: 0.7,
          command: 'npx vitest run',
        });
      }
      if (deps.playwright && !detections.find(d => d.framework === 'playwright')) {
        detections.push({
          framework: 'playwright',
          confidence: 0.6,
          command: 'npx playwright test',
        });
      }
      if (deps.cypress && !detections.find(d => d.framework === 'cypress')) {
        detections.push({
          framework: 'cypress',
          confidence: 0.6,
          command: 'npx cypress run',
        });
      }
    } catch {
      // Ignore parse errors
    }
  }

  return detections.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Parse test scripts from package.json
 */
export function parseTestScripts(projectRoot: string): PackageTestScripts {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return {};
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
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
 * Discover all test suites in a project
 */
export async function discoverTestSuites(projectRoot: string): Promise<TestSuite[]> {
  const suites: TestSuite[] = [];
  const detections = detectFramework(projectRoot);
  const testScripts = parseTestScripts(projectRoot);

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
 * Format suite name for display
 */
function formatSuiteName(scriptName: string): string {
  // test:unit → Unit Tests
  // test:e2e → E2E Tests
  // test → All Tests
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
 * Build file-to-test mapping
 * Maps source files to their test files
 */
export async function buildFileTestMap(projectRoot: string): Promise<FileTestMapping[]> {
  const mappings: FileTestMapping[] = [];
  const srcDirs = ['src', 'lib', 'app', 'components', 'pages'];
  const testPatterns = [
    '.test.ts', '.test.tsx', '.test.js', '.test.jsx',
    '.spec.ts', '.spec.tsx', '.spec.js', '.spec.jsx',
  ];

  for (const srcDir of srcDirs) {
    const srcPath = path.join(projectRoot, srcDir);
    if (!fs.existsSync(srcPath)) continue;

    const sourceFiles = walkDir(srcPath, ['.ts', '.tsx', '.js', '.jsx']);

    for (const sourceFile of sourceFiles) {
      // Skip test files themselves
      if (testPatterns.some(p => sourceFile.endsWith(p))) continue;

      const testFiles: string[] = [];
      const baseName = path.basename(sourceFile).replace(/\.(ts|tsx|js|jsx)$/, '');
      const dir = path.dirname(sourceFile);

      // Check for co-located test files
      for (const pattern of testPatterns) {
        const testFile = path.join(dir, baseName + pattern);
        if (fs.existsSync(testFile)) {
          testFiles.push(path.relative(projectRoot, testFile));
        }
      }

      // Check __tests__ directory
      const testsDir = path.join(dir, '__tests__');
      if (fs.existsSync(testsDir)) {
        for (const pattern of testPatterns) {
          const testFile = path.join(testsDir, baseName + pattern);
          if (fs.existsSync(testFile)) {
            testFiles.push(path.relative(projectRoot, testFile));
          }
        }
      }

      if (testFiles.length > 0) {
        mappings.push({
          sourcePath: path.relative(projectRoot, sourceFile),
          testFiles,
        });
      }
    }
  }

  return mappings;
}

/**
 * Walk directory recursively
 */
function walkDir(dir: string, extensions: string[], maxDepth = 5): string[] {
  const files: string[] = [];

  function walk(currentDir: string, depth: number) {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (['node_modules', '.git', 'dist', 'build', 'coverage'].includes(entry.name)) {
            continue;
          }
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  walk(dir, 0);
  return files;
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
    // Normalize path
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
 * Load test meta from .f0/test-meta.json
 */
export function loadTestMeta(projectRoot: string): TestMeta | null {
  const metaPath = path.join(projectRoot, '.f0', 'test-meta.json');

  if (!fs.existsSync(metaPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(metaPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save test meta to .f0/test-meta.json
 */
export function saveTestMeta(projectRoot: string, meta: TestMeta): void {
  const f0Dir = path.join(projectRoot, '.f0');

  if (!fs.existsSync(f0Dir)) {
    fs.mkdirSync(f0Dir, { recursive: true });
  }

  const metaPath = path.join(f0Dir, 'test-meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

/**
 * Discover and cache test meta
 */
export async function discoverAndCacheTests(projectRoot: string): Promise<TestMeta> {
  console.log('[TestDiscovery] Discovering tests for:', projectRoot);

  const suites = await discoverTestSuites(projectRoot);
  const fileTestMap = await buildFileTestMap(projectRoot);
  const detections = detectFramework(projectRoot);

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

