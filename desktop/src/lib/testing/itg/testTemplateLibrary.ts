// desktop/src/lib/testing/itg/testTemplateLibrary.ts
// Phase 139.2: Test Template Library for ITG
// Provides test templates for different file types

/**
 * Converts file path to proper import path for tests
 * Examples:
 *   src/lib/foo.ts  →  '@/lib/foo'
 *   src/app/api/bar/route.ts → '@/app/api/bar/route'
 */
export function normalizeImportPath(filePath: string): string {
  if (!filePath) return filePath;

  let p = filePath.replace(/\\/g, '/'); // windows → posix

  if (p.startsWith('./')) p = p.slice(2);
  if (p.startsWith('src/')) p = p.slice(4);

  if (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js') || p.endsWith('.jsx')) {
    p = p.replace(/\.(ts|tsx|js|jsx)$/, '');
  }

  return p.startsWith('@/') ? p : `@/${p}`;
}

/**
 * Template for testing regular functions (utilities, services, etc.)
 */
export function buildFunctionUnitTestTemplate(
  symbolName: string,
  filePath: string
): string {
  const importPath = normalizeImportPath(filePath);

  return `import { ${symbolName} } from '${importPath}';

describe('${symbolName}', () => {
  it('should handle the basic case', () => {
    // Arrange
    const input = undefined; // TODO: provide real input

    // Act
    const result = ${symbolName}(input as any);

    // Assert
    expect(result).toBeDefined();
  });

  it('should handle edge cases', () => {
    // TODO: add more edge-case scenarios
  });
});
`;
}

/**
 * Template for testing React Components (Client / Server)
 * Uses renderToString from react-dom/server to avoid extra libs.
 */
export function buildReactComponentTestTemplate(
  componentName: string,
  filePath: string
): string {
  const importPath = normalizeImportPath(filePath);

  return `import React from 'react';
import { renderToString } from 'react-dom/server';
import { ${componentName} } from '${importPath}';

describe('<${componentName} />', () => {
  it('renders without crashing', () => {
    const html = renderToString(<${componentName} />);
    expect(html).toContain('');
  });

  it('supports basic props', () => {
    // TODO: pass realistic props and assert on output
  });
});
`;
}

/**
 * Template for testing API Routes (Next.js / server handlers)
 */
export function buildApiRouteTestTemplate(
  handlerName: string,
  filePath: string
): string {
  const importPath = normalizeImportPath(filePath);

  return `import { ${handlerName} } from '${importPath}';

describe('${handlerName} API handler', () => {
  it('returns 200 for a basic request', async () => {
    const req = {} as any; // TODO: mock Request
    const res = await ${handlerName}(req);

    // TODO: adjust expectations based on response type
    expect(res).toBeDefined();
  });

  it('handles invalid input gracefully', async () => {
    const req = {} as any; // TODO: mock invalid Request
    const res = await ${handlerName}(req);
    expect(res).toBeDefined();
  });
});
`;
}

/**
 * Generic fallback template when file type is unknown
 */
export function buildGenericFileTestTemplate(filePath: string): string {
  const importPath = normalizeImportPath(filePath);

  return `import * as ModuleUnderTest from '${importPath}';

describe('${filePath}', () => {
  it('has at least one exported member', () => {
    expect(Object.keys(ModuleUnderTest).length).toBeGreaterThan(0);
  });

  // TODO: add more specific tests for key exports
});
`;
}
