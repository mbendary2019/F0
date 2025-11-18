// src/lib/analyzer/scanProject.ts
// Phase 74: Project Scanner for detecting tech stack and structure

import type {
  ProjectAnalysis,
  ProjectType,
  FrameworkInfo,
  DetectedFeatures,
  EntryPointInfo,
} from '@/types/projectAnalyzer';

/**
 * Scans a project directory and returns comprehensive analysis
 * Note: This is designed for Node.js environments (Desktop app / CLI)
 * For web environments, use the backend API instead
 */
export async function scanProject(rootDir: string): Promise<ProjectAnalysis> {
  // This function requires fs module - only works in Node.js environment
  if (typeof window !== 'undefined') {
    throw new Error('scanProject can only be called from Node.js environment (Desktop app)');
  }

  const fs = await import('fs');
  const path = await import('path');

  // 1) Read package.json or pubspec.yaml
  const packageJsonPath = path.join(rootDir, 'package.json');
  const pubspecPath = path.join(rootDir, 'pubspec.yaml');

  let dependencies: string[] = [];
  let projectType: ProjectType = 'unknown';
  let framework: FrameworkInfo = {
    name: 'unknown',
    language: 'ts',
  };

  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    dependencies = Object.keys({
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    });

    // Detect project type from dependencies
    if (dependencies.includes('next')) {
      projectType = 'nextjs';
      const nextVersion = pkg.dependencies?.next || pkg.devDependencies?.next || 'unknown';
      framework = {
        name: `next-${nextVersion.replace('^', '').split('.')[0]}`,
        language: dependencies.includes('typescript') ? 'ts' : 'js',
      };
    } else if (dependencies.includes('expo')) {
      projectType = 'expo';
      framework = {
        name: 'expo',
        language: dependencies.includes('typescript') ? 'ts' : 'js',
      };
    } else if (dependencies.includes('react-native')) {
      projectType = 'react-native';
      framework = {
        name: 'react-native',
        language: dependencies.includes('typescript') ? 'ts' : 'js',
      };
    } else if (dependencies.includes('react')) {
      projectType = 'react';
      framework = {
        name: 'react',
        language: dependencies.includes('typescript') ? 'ts' : 'js',
      };
    } else if (dependencies.includes('express') || dependencies.includes('fastify')) {
      projectType = 'node-api';
      framework = {
        name: 'node',
        language: dependencies.includes('typescript') ? 'ts' : 'js',
      };
    } else if (fs.existsSync(path.join(rootDir, 'index.html'))) {
      projectType = 'static';
      framework = {
        name: 'static-html',
        language: 'js',
      };
    }
  } else if (fs.existsSync(pubspecPath)) {
    projectType = 'flutter';
    framework = {
      name: 'flutter',
      language: 'dart',
    };
    // Could parse pubspec.yaml for dependencies if needed
  }

  // 2) Count files and calculate total size + infer entry points
  const allFiles: string[] = [];
  let totalSize = 0;

  function walk(dir: string) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            // Skip common ignored directories
            if (['.git', 'node_modules', '.next', 'build', 'dist', '.expo', 'android', 'ios', 'coverage'].includes(item)) {
              continue;
            }
            walk(fullPath);
          } else {
            const relativePath = path.relative(rootDir, fullPath);
            allFiles.push(relativePath);
            totalSize += stat.size;
          }
        } catch (err) {
          // Skip files we can't access
          console.warn(`Skipping ${fullPath}:`, err);
        }
      }
    } catch (err) {
      console.warn(`Cannot read directory ${dir}:`, err);
    }
  }

  walk(rootDir);

  // 3) Detect entry points
  const entries: EntryPointInfo = {
    mainEntries: [],
    apiEntries: [],
    mobileEntries: [],
  };

  for (const file of allFiles) {
    const normalized = file.replace(/\\/g, '/'); // Normalize Windows paths

    // Next.js App Router entry points
    if (normalized === 'src/app/page.tsx' || normalized === 'src/app/page.jsx' || normalized === 'app/page.tsx' || normalized === 'app/page.jsx') {
      entries.mainEntries.push(file);
    }

    // Pages Router entry points
    if (normalized === 'pages/index.tsx' || normalized === 'pages/index.jsx') {
      entries.mainEntries.push(file);
    }

    // React entry points
    if (normalized === 'src/index.tsx' || normalized === 'src/index.jsx' || normalized === 'src/App.tsx' || normalized === 'src/App.jsx') {
      entries.mainEntries.push(file);
    }

    // API routes (Next.js App Router)
    if (normalized.includes('/api/') && (normalized.endsWith('/route.ts') || normalized.endsWith('/route.js'))) {
      entries.apiEntries.push(file);
    }

    // API routes (Next.js Pages Router)
    if (normalized.startsWith('pages/api/') && (normalized.endsWith('.ts') || normalized.endsWith('.js'))) {
      entries.apiEntries.push(file);
    }

    // Flutter entry
    if (normalized.endsWith('main.dart')) {
      entries.mobileEntries.push(file);
    }

    // React Native entry
    if (normalized === 'index.js' || normalized === 'App.tsx' || normalized === 'App.jsx') {
      if (projectType === 'react-native' || projectType === 'expo') {
        entries.mobileEntries.push(file);
      }
    }
  }

  // 4) Detect features from files and dependencies
  const features: DetectedFeatures = {
    hasAuth: dependencies.some((d) => d.includes('next-auth') || d.includes('firebase') || d.includes('auth0') || d.includes('clerk')),
    hasFirebase: dependencies.some((d) => d.includes('firebase')),
    hasStripe: dependencies.some((d) => d.includes('stripe')),
    hasI18n: dependencies.some((d) => d.includes('next-intl') || d.includes('i18next') || d.includes('react-intl')),
    hasTailwind: dependencies.includes('tailwindcss'),
    hasShadcn: dependencies.some((d) => d.includes('@radix-ui') || d.includes('shadcn') || allFiles.some(f => f.includes('components/ui'))),
    hasBackendApi: entries.apiEntries.length > 0 || allFiles.some(f => f.includes('functions/')),
  };

  const analysis: ProjectAnalysis = {
    projectType,
    framework,
    features,
    entries,
    dependencies,
    fileCount: allFiles.length,
    totalSizeBytes: totalSize,
    analyzedAt: new Date().toISOString(),
  };

  return analysis;
}
