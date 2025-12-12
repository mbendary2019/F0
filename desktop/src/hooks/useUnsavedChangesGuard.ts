// desktop/src/hooks/useUnsavedChangesGuard.ts
// Phase 113.3: Prevent closing/reloading with unsaved changes
import { useEffect } from 'react';

/**
 * Hook to warn users when they try to close/reload with unsaved changes
 * Works with both browser and Electron's beforeunload event
 */
export function useUnsavedChangesGuard(hasDirty: boolean, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasDirty) return;

      // Prevent the default close/reload behavior
      event.preventDefault();
      // This line is required for Chrome/Electron to show the dialog
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasDirty, enabled]);
}
