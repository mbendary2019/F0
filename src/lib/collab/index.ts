// src/lib/collab/index.ts
// Phase 53: Realtime Collaboration - Main Exports

// Core client
export {
  createCollabClient,
  generateRoomId,
  isWebRTCSupported,
  type CollabClient,
  type CollabTransport,
  type JoinResponse
} from "./createCollabClient";

// React hooks
export {
  useCollabClient,
  useCollabClientSimple
} from "./useCollabClient";

export {
  usePresence,
  useIdleDetection,
  generateUserColor,
  type PresenceState
} from "./usePresence";

// Editor bindings
export {
  MonacoYBinding,
  getOffsetFromPosition,
  getPositionFromOffset
} from "./monacoBinding";

// Re-export Y.js types for convenience
export type { Doc, Text, Map, Array as YArray } from "yjs";
