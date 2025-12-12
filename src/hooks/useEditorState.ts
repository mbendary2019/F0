// src/hooks/useEditorState.ts
// =============================================================================
// Phase 152.1 – Local editor state per file
// Tracks original content, current content, and dirty state
// =============================================================================
// Phase 152 – Web Code Editor v1 (LOCKED)
// NOTE: Any major behavioral changes should be done in Phase >= 153.
// =============================================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// =============================================================================
// Types
// =============================================================================
export type EditorState = {
  /** Current content in the editor */
  content: string;
  /** Original content from backend/Firestore */
  originalContent: string;
  /** Whether content has been modified */
  isDirty: boolean;
  /** Update content */
  setContent: (v: string) => void;
  /** Reset to original content */
  reset: () => void;
  /** Mark as saved (update original to match current) */
  markSaved: () => void;
};

// =============================================================================
// Hook
// =============================================================================
export function useEditorState(
  filePath: string | null,
  backendContent: string
): EditorState {
  const [content, setContentState] = useState(backendContent);
  const [originalContent, setOriginalContent] = useState(backendContent);

  // Track if we're in the middle of a file switch
  const isFileSwitchRef = useRef(false);
  const prevFilePathRef = useRef(filePath);

  // When file path changes or backend content changes, reset state
  useEffect(() => {
    // Detect file switch
    const isFileSwitch = filePath !== prevFilePathRef.current;
    prevFilePathRef.current = filePath;

    if (isFileSwitch) {
      // Complete reset on file switch
      isFileSwitchRef.current = true;
      setContentState(backendContent);
      setOriginalContent(backendContent);

      console.log('[152.1][WEB][EDITOR_STATE] File switched, reset state', {
        filePath,
        contentLength: backendContent.length,
      });

      // Clear flag after state updates
      setTimeout(() => {
        isFileSwitchRef.current = false;
      }, 0);
    } else if (!isFileSwitchRef.current) {
      // Backend content changed for same file (e.g., realtime sync)
      // Only update if user hasn't made changes (isDirty check)
      const isDirty = content !== originalContent;

      if (!isDirty) {
        setContentState(backendContent);
        setOriginalContent(backendContent);

        console.log('[152.1][WEB][EDITOR_STATE] Backend sync, updated content', {
          filePath,
          contentLength: backendContent.length,
        });
      } else {
        // User has changes, update only original for comparison
        setOriginalContent(backendContent);

        console.log('[152.1][WEB][EDITOR_STATE] Backend sync, user has changes', {
          filePath,
          contentLength: backendContent.length,
          userContentLength: content.length,
        });
      }
    }
  }, [filePath, backendContent]);

  // Set content handler
  const setContent = useCallback((v: string) => {
    setContentState(v);
  }, []);

  // Reset to original content
  const reset = useCallback(() => {
    setContentState(originalContent);
    console.log('[152.1][WEB][EDITOR_STATE] Reset to original', { filePath });
  }, [originalContent, filePath]);

  // Mark as saved (after successful save)
  const markSaved = useCallback(() => {
    setOriginalContent(content);
    console.log('[152.1][WEB][EDITOR_STATE] Marked as saved', { filePath });
  }, [content, filePath]);

  // Compute isDirty
  const isDirty = content !== originalContent;

  return {
    content,
    originalContent,
    isDirty,
    setContent,
    reset,
    markSaved,
  };
}

export default useEditorState;
