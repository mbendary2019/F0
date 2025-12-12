// desktop/src/hooks/useRagContext.ts
// Phase 122.2: Hook for RAG-Lite context integration
// Provides indexed project context for agent questions

import { useState, useCallback } from 'react';
import {
  getQuickContext,
  type ContextFile,
} from '../lib/rag/projectContextFromIndex';
import {
  buildContextMessages,
  type ChatMessage,
} from '../lib/rag/answerWithIndexedContext';

export interface RagContextState {
  isLoading: boolean;
  contextFiles: ContextFile[];
  error: string | null;
}

export interface UseRagContextReturn {
  state: RagContextState;
  getContext: (projectRoot: string, query: string) => Promise<ContextFile[]>;
  buildMessages: (options: {
    projectRoot: string;
    userQuestion: string;
    activeFilePath?: string | null;
    activeFileContent?: string | null;
    language?: 'en' | 'ar';
  }) => Promise<{ messages: ChatMessage[]; contextFiles: ContextFile[] }>;
  clearContext: () => void;
}

/**
 * Hook for managing RAG-Lite context in the agent panel
 * Provides functions to fetch relevant project files for context
 */
export function useRagContext(): UseRagContextReturn {
  const [state, setState] = useState<RagContextState>({
    isLoading: false,
    contextFiles: [],
    error: null,
  });

  /**
   * Get context files for a query
   */
  const getContext = useCallback(async (
    projectRoot: string,
    query: string
  ): Promise<ContextFile[]> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const files = await getQuickContext(projectRoot, query, 6);
      setState({ isLoading: false, contextFiles: files, error: null });
      return files;
    } catch (err: any) {
      const error = err?.message || 'Failed to get context';
      setState({ isLoading: false, contextFiles: [], error });
      console.error('[useRagContext] Error:', err);
      return [];
    }
  }, []);

  /**
   * Build chat messages with indexed context
   */
  const buildMessages = useCallback(async (options: {
    projectRoot: string;
    userQuestion: string;
    activeFilePath?: string | null;
    activeFileContent?: string | null;
    language?: 'en' | 'ar';
  }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await buildContextMessages({
        projectRoot: options.projectRoot,
        userQuestion: options.userQuestion,
        activeFilePath: options.activeFilePath,
        activeFileContent: options.activeFileContent,
        language: options.language,
      });

      setState({
        isLoading: false,
        contextFiles: result.contextFiles,
        error: null,
      });

      return result;
    } catch (err: any) {
      const error = err?.message || 'Failed to build context messages';
      setState({ isLoading: false, contextFiles: [], error });
      console.error('[useRagContext] Error building messages:', err);
      return { messages: [], contextFiles: [] };
    }
  }, []);

  /**
   * Clear context state
   */
  const clearContext = useCallback(() => {
    setState({
      isLoading: false,
      contextFiles: [],
      error: null,
    });
  }, []);

  return {
    state,
    getContext,
    buildMessages,
    clearContext,
  };
}

export default useRagContext;
