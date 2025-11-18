// src/lib/collab/usePresence.ts
// Phase 53 Day 2: Presence & Awareness Hook

import { useEffect, useState, useCallback } from "react";

/**
 * Presence state for a connected user
 */
export interface PresenceState {
  clientId: number;
  name?: string;
  color?: string;
  cursor?: { from: number; to: number } | null;
  selection?: { from: number; to: number } | null;
  idle?: boolean;
  avatar?: string;
  role?: "editor" | "viewer";
  lastActivity?: number;
}

/**
 * Hook to manage presence awareness in a collaborative session
 *
 * Tracks:
 * - Connected peers
 * - Local user state (cursor, name, color)
 * - Idle detection
 *
 * @param awareness - Y.js awareness instance from provider
 * @param self - Local user state (without clientId)
 *
 * @returns { peers, setLocalState, updateCursor }
 */
export function usePresence(
  awareness: any,
  self: Omit<PresenceState, "clientId">
) {
  const [peers, setPeers] = useState<PresenceState[]>([]);

  // Update peers list when awareness changes
  useEffect(() => {
    if (!awareness) return;

    const onChange = () => {
      const states = Array.from(awareness.getStates().entries())
        .map(([clientId, state]: [number, any]) => ({
          clientId,
          ...state
        }))
        .filter((p: PresenceState) => p.clientId !== awareness.clientID); // Exclude self

      setPeers(states);
    };

    awareness.on("change", onChange);
    onChange(); // Initial load

    return () => awareness.off("change", onChange);
  }, [awareness]);

  // Set local state (name, color, etc.)
  useEffect(() => {
    if (!awareness) return;

    const localState = {
      ...self,
      lastActivity: Date.now()
    };

    awareness.setLocalState(localState);
  }, [awareness, self.name, self.color, self.role, self.avatar]);

  // Callback to update local state dynamically
  const setLocalState = useCallback((updates: Partial<PresenceState>) => {
    if (!awareness) return;

    const current = awareness.getLocalState() || {};
    awareness.setLocalState({
      ...current,
      ...updates,
      lastActivity: Date.now()
    });
  }, [awareness]);

  // Helper to update cursor position
  const updateCursor = useCallback((cursor: { from: number; to: number } | null) => {
    setLocalState({ cursor, idle: false });
  }, [setLocalState]);

  // Helper to mark user as idle
  const setIdle = useCallback((idle: boolean) => {
    setLocalState({ idle });
  }, [setLocalState]);

  return {
    peers,
    setLocalState,
    updateCursor,
    setIdle
  };
}

/**
 * Hook for idle detection
 * Marks user as idle after specified timeout
 */
export function useIdleDetection(
  setIdle: (idle: boolean) => void,
  timeout: number = 30000 // 30 seconds
) {
  useEffect(() => {
    let idleTimer: NodeJS.Timeout;

    const resetIdleTimer = () => {
      setIdle(false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setIdle(true), timeout);
    };

    // Listen to user activity
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach(event => {
      document.addEventListener(event, resetIdleTimer);
    });

    resetIdleTimer(); // Initial

    return () => {
      clearTimeout(idleTimer);
      events.forEach(event => {
        document.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [setIdle, timeout]);
}

/**
 * Generate a random user color
 */
export function generateUserColor(seed?: string): string {
  const colors = [
    "#6C5CE7", // Purple
    "#00B894", // Green
    "#0984E3", // Blue
    "#FD79A8", // Pink
    "#FDCB6E", // Yellow
    "#E17055", // Orange
    "#74B9FF", // Light Blue
    "#A29BFE", // Light Purple
    "#55EFC4", // Mint
    "#FF7675", // Red
    "#00CEC9", // Cyan
    "#FAB1A0"  // Peach
  ];

  if (seed) {
    // Generate deterministic color from seed
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  // Random color
  return colors[Math.floor(Math.random() * colors.length)];
}
