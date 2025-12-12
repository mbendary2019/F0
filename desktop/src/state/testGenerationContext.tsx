// desktop/src/state/testGenerationContext.tsx
// Phase 133.2: Test Generation Context - manages state for "Generate tests" feature

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { buildTestGenerationPrompt, detectTestFramework } from '../lib/ace/testGenerationPrompts';

/**
 * Test generation request
 */
interface TestGenerationRequest {
  sourcePath: string;
  sourceCode: string;
  prompt: string;
  framework: 'vitest' | 'jest';
  requestedAt: string;
}

/**
 * Context value type
 */
interface TestGenerationContextValue {
  /** Current pending request (if any) */
  pendingRequest: TestGenerationRequest | null;
  /** Request test generation for a file */
  requestTestGeneration: (sourcePath: string, sourceCode: string) => void;
  /** Clear the pending request (after ACE processes it) */
  clearRequest: () => void;
  /** Check if there's a pending request */
  hasPendingRequest: boolean;
}

const TestGenerationContext = createContext<TestGenerationContextValue | null>(null);

/**
 * Test Generation Provider
 */
export const TestGenerationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingRequest, setPendingRequest] = useState<TestGenerationRequest | null>(null);

  const requestTestGeneration = useCallback((sourcePath: string, sourceCode: string) => {
    // Detect framework (default to vitest)
    const framework = detectTestFramework();

    // Build the prompt
    const prompt = buildTestGenerationPrompt({
      sourcePath,
      sourceCode,
      framework,
    });

    const request: TestGenerationRequest = {
      sourcePath,
      sourceCode,
      prompt,
      framework,
      requestedAt: new Date().toISOString(),
    };

    setPendingRequest(request);
    console.log('[TestGeneration] Request created for:', sourcePath);
  }, []);

  const clearRequest = useCallback(() => {
    setPendingRequest(null);
    console.log('[TestGeneration] Request cleared');
  }, []);

  const value = useMemo<TestGenerationContextValue>(
    () => ({
      pendingRequest,
      requestTestGeneration,
      clearRequest,
      hasPendingRequest: pendingRequest !== null,
    }),
    [pendingRequest, requestTestGeneration, clearRequest]
  );

  return (
    <TestGenerationContext.Provider value={value}>
      {children}
    </TestGenerationContext.Provider>
  );
};

/**
 * Hook to use test generation context
 */
export function useTestGeneration(): TestGenerationContextValue {
  const context = useContext(TestGenerationContext);
  if (!context) {
    throw new Error('useTestGeneration must be used within a TestGenerationProvider');
  }
  return context;
}

export default TestGenerationProvider;
