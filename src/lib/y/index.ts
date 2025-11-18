// Centralized Y.js exports to prevent "Yjs was already imported" warning
// Always import from this file instead of importing from yjs/y-webrtc directly

export * as Y from 'yjs';
export { WebrtcProvider } from 'y-webrtc';
export { Awareness } from 'y-protocols/awareness';
