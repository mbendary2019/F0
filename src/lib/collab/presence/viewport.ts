/**
 * Phase 53 Day 3 - Live Cursors & Selections
 * Viewport and coordinate transformation utilities
 */

import type { CursorPoint, ViewportInfo } from './types';

/**
 * Get viewport information from an element or window
 * @param el - Container element (null = use window)
 */
export const getViewport = (el: HTMLElement | null): ViewportInfo => {
  if (!el) {
    return {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scale: 1,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }
  return {
    scrollX: el.scrollLeft,
    scrollY: el.scrollTop,
    scale: 1,
    width: el.clientWidth,
    height: el.clientHeight,
  };
};

/**
 * Convert client coordinates to container-relative coordinates
 * Takes into account scroll position and container offset
 * @param container - Container element (null = use window coordinates)
 * @param clientX - Mouse X position relative to viewport
 * @param clientY - Mouse Y position relative to viewport
 */
export const clientToContainer = (
  container: HTMLElement | null,
  clientX: number,
  clientY: number
): CursorPoint => {
  if (!container) {
    return { x: clientX, y: clientY };
  }

  const rect = container.getBoundingClientRect();
  return {
    x: clientX - rect.left + container.scrollLeft,
    y: clientY - rect.top + container.scrollTop,
  };
};
