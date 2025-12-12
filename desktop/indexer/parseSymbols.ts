// desktop/indexer/parseSymbols.ts
// Phase 121.1: Regex-based symbol and export extraction
// Extracts functions, classes, components, hooks, and exports from JS/TS files

import type { IndexedFileLanguage } from './types';

/**
 * Result of symbol extraction
 */
export type ExtractedSymbols = {
  /** All symbol names found (functions, classes, hooks, components) */
  symbols: string[];
  /** Exported symbol names */
  exports: string[];
};

/**
 * Check if a language supports symbol extraction
 */
function isJsOrTs(lang: IndexedFileLanguage): boolean {
  return ['typescript', 'javascript', 'tsx', 'jsx'].includes(lang);
}

/**
 * Extract symbols and exports from file content
 * Uses regex-based parsing (not AST) for speed
 * Catches ~80-90% of common patterns
 */
export function extractSymbolsAndExports(
  content: string,
  language: IndexedFileLanguage
): ExtractedSymbols {
  // Only parse JS/TS files
  if (!isJsOrTs(language)) {
    return { symbols: [], exports: [] };
  }

  const symbols = new Set<string>();
  const exports = new Set<string>();

  // ============================================
  // Function declarations: function myFunc() {}
  // ============================================
  const fnDecl = [...content.matchAll(/\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)];
  fnDecl.forEach((m) => symbols.add(m[1]));

  // ============================================
  // Arrow functions: const myFunc = () => {} or async
  // ============================================
  const arrowFn = [
    ...content.matchAll(
      /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/g
    ),
  ];
  arrowFn.forEach((m) => symbols.add(m[1]));

  // ============================================
  // Class declarations: class MyService {}
  // ============================================
  const classDecl = [...content.matchAll(/\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)];
  classDecl.forEach((m) => symbols.add(m[1]));

  // ============================================
  // Type/Interface declarations (TS only)
  // ============================================
  if (language === 'typescript' || language === 'tsx') {
    const typeDecl = [...content.matchAll(/\b(?:type|interface)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)];
    typeDecl.forEach((m) => symbols.add(m[1]));
  }

  // ============================================
  // React hooks: useAuth, useState, etc
  // ============================================
  const hooks = [...content.matchAll(/\b(use[A-Z][A-Za-z0-9_]*)\b/g)];
  hooks.forEach((m) => symbols.add(m[1]));

  // ============================================
  // Export patterns
  // ============================================

  // export function Something() {}
  const exportFn = [
    ...content.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/g),
  ];
  exportFn.forEach((m) => {
    symbols.add(m[1]);
    exports.add(m[1]);
  });

  // export const Something = ...
  const exportConst = [
    ...content.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g),
  ];
  exportConst.forEach((m) => {
    symbols.add(m[1]);
    exports.add(m[1]);
  });

  // export class Something {}
  const exportClass = [
    ...content.matchAll(/export\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/g),
  ];
  exportClass.forEach((m) => {
    symbols.add(m[1]);
    exports.add(m[1]);
  });

  // export type/interface (TS)
  if (language === 'typescript' || language === 'tsx') {
    const exportType = [
      ...content.matchAll(/export\s+(?:type|interface)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g),
    ];
    exportType.forEach((m) => {
      symbols.add(m[1]);
      exports.add(m[1]);
    });
  }

  // export default function Something() {}
  const defaultFn = [
    ...content.matchAll(/export\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/g),
  ];
  defaultFn.forEach((m) => {
    symbols.add(m[1]);
    exports.add(m[1]);
  });

  // export default class Something {}
  const defaultClass = [
    ...content.matchAll(/export\s+default\s+class\s+([A-Za-z_$][A-Za-z0-9_$]*)/g),
  ];
  defaultClass.forEach((m) => {
    symbols.add(m[1]);
    exports.add(m[1]);
  });

  // export default SomeIdentifier;
  const defaultVar = [
    ...content.matchAll(/export\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;/g),
  ];
  defaultVar.forEach((m) => {
    // Only add if it looks like a component/class (PascalCase)
    if (/^[A-Z]/.test(m[1])) {
      symbols.add(m[1]);
      exports.add(m[1]);
    }
  });

  // Named exports: export { A, B, C as D }
  const namedExportsBlocks = [
    ...content.matchAll(/export\s*\{\s*([^}]+)\}/g),
  ];
  for (const block of namedExportsBlocks) {
    const inside = block[1];
    inside
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((part) => {
        // Handle "A" or "A as B"
        const asMatch = part.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
        if (asMatch) {
          // "A as B" - A is internal, B is exported name
          symbols.add(asMatch[1]);
          symbols.add(asMatch[2]);
          exports.add(asMatch[2]);
        } else {
          // Simple "A"
          const simple = part.match(/^([A-Za-z_$][A-Za-z0-9_$]*)$/);
          if (simple) {
            symbols.add(simple[1]);
            exports.add(simple[1]);
          }
        }
      });
  }

  // Re-exports: export { Something } from './module'
  // Already handled by named exports pattern above

  // ============================================
  // React component patterns (PascalCase functions returning JSX)
  // Already captured by function/arrow patterns, but ensure PascalCase
  // ============================================

  return {
    symbols: Array.from(symbols).filter((s) => s.length > 1), // Filter out single chars
    exports: Array.from(exports).filter((s) => s.length > 1),
  };
}

export default extractSymbolsAndExports;
