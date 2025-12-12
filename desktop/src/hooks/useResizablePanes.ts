// desktop/src/hooks/useResizablePanes.ts
// Phase 132: Added preview pane width for full resizable layout
import { useState, useCallback, useRef, useEffect } from 'react';

export type PaneSizes = {
  left: number;   // File tree width in pixels
  right: number;  // Agent panel width in pixels
  preview: number; // Preview pane width in pixels (Phase 132)
};

const MIN_LEFT_WIDTH = 180;
const MAX_LEFT_WIDTH = 400;
const MIN_RIGHT_WIDTH = 200;  // Reduced for when preview is open
const MAX_RIGHT_WIDTH = 600;
const MIN_PREVIEW_WIDTH = 300;
const MAX_PREVIEW_WIDTH = 1600;  // Phase 132.4: Increased to allow larger preview
const MIN_CENTER_WIDTH = 200;  // Phase 132.4: Reduced further for more preview space

const STORAGE_KEY = 'f0-pane-sizes';

/**
 * Load saved sizes from localStorage
 * Phase 132.4: Updated to use new max values
 */
function loadSavedSizes(): PaneSizes {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        left: Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, parsed.left || 260)),
        right: Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, parsed.right || 340)),
        preview: Math.max(MIN_PREVIEW_WIDTH, Math.min(MAX_PREVIEW_WIDTH, parsed.preview || 500)),
      };
    }
  } catch (e) {
    // Ignore errors
  }
  return { left: 260, right: 340, preview: 500 };
}

/**
 * Save sizes to localStorage
 */
function saveSizes(sizes: PaneSizes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch (e) {
    // Ignore errors
  }
}

export function useResizablePanes() {
  const [sizes, setSizes] = useState<PaneSizes>(loadSavedSizes);
  const [isDragging, setIsDragging] = useState<'left' | 'right' | 'preview' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Start dragging a divider
   * Phase 132: Added 'preview' option
   */
  const startDrag = useCallback((side: 'left' | 'right' | 'preview') => {
    setIsDragging(side);
  }, []);

  /**
   * Handle mouse move during drag
   * Phase 132: Added preview pane resize support
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const containerWidth = rect.width;

      if (isDragging === 'left') {
        // Dragging left divider - adjust file tree width
        const newLeft = Math.max(
          MIN_LEFT_WIDTH,
          Math.min(MAX_LEFT_WIDTH, e.clientX - rect.left)
        );

        // Make sure center pane stays large enough
        const maxLeftForCenter = containerWidth - sizes.right - sizes.preview - MIN_CENTER_WIDTH;
        const finalLeft = Math.min(newLeft, Math.max(MIN_LEFT_WIDTH, maxLeftForCenter));

        setSizes(prev => ({ ...prev, left: finalLeft }));
      } else if (isDragging === 'right') {
        // Dragging right divider - adjust agent panel width
        // Calculate position relative to the right edge of container
        const distanceFromRight = rect.right - e.clientX;

        // Agent pane width is the distance from cursor to the preview pane start
        // The preview pane is at the far right
        const newRight = Math.max(
          MIN_RIGHT_WIDTH,
          Math.min(MAX_RIGHT_WIDTH, distanceFromRight - sizes.preview)
        );

        // Make sure center pane stays large enough
        const maxRightForCenter = containerWidth - sizes.left - sizes.preview - MIN_CENTER_WIDTH;
        const finalRight = Math.min(newRight, Math.max(MIN_RIGHT_WIDTH, maxRightForCenter));

        setSizes(prev => ({ ...prev, right: finalRight }));
      } else if (isDragging === 'preview') {
        // Phase 132: Dragging preview divider - adjust preview pane width
        const newPreview = Math.max(
          MIN_PREVIEW_WIDTH,
          Math.min(MAX_PREVIEW_WIDTH, rect.right - e.clientX)
        );

        // Make sure other panes stay large enough
        const maxPreviewForLayout = containerWidth - sizes.left - sizes.right - MIN_CENTER_WIDTH;
        const finalPreview = Math.min(newPreview, Math.max(MIN_PREVIEW_WIDTH, maxPreviewForLayout));

        setSizes(prev => ({ ...prev, preview: finalPreview }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      saveSizes(sizes);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, sizes]);

  /**
   * Double-click to reset to default
   * Phase 132: Added preview to defaults
   */
  const resetSizes = useCallback(() => {
    const defaults = { left: 260, right: 340, preview: 500 };
    setSizes(defaults);
    saveSizes(defaults);
  }, []);

  return {
    sizes,
    isDragging,
    containerRef,
    startDrag,
    resetSizes,
  };
}
