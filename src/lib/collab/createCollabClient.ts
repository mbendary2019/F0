// src/lib/collab/createCollabClient.ts
// Phase 53 Day 3: Enhanced with Live Cursors & Awareness

import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { WebrtcProvider } from "y-webrtc";
import { WebsocketProvider } from "y-websocket";
import { nanoid } from "nanoid";

export type CollabTransport = "webrtc" | "websocket" | "auto";

export interface JoinResponse {
  token: string;
  iceServers?: RTCIceServer[];
  signalingUrl?: string; // e.g. wss://collab-signal.f0.app
  wsUrl?: string;        // e.g. wss://collab-ws.f0.app
  roomId?: string;
}

export interface CollabClient {
  id: string;
  doc: Y.Doc;
  ytext: Y.Text;
  awareness: Awareness;
  provider: any;
  transport: "webrtc" | "websocket";
  reconnect(): void;
  destroy(): void;
}

export interface UserPresence {
  name: string;
  color: string;
  cursor?: {
    position: { lineNumber: number; column: number };
    selection?: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    };
  };
}

/**
 * Create a collaborative client with Y.js CRDT and transport layer
 *
 * @param roomId - Unique room identifier
 * @param getJoin - Function to fetch join credentials from backend
 * @param transport - Transport method: "webrtc" (mesh), "websocket" (relay), or "auto"
 * @param field - Y.Text field name (default: "code")
 *
 * @returns CollabClient with doc, ytext, awareness, and provider
 */
export async function createCollabClient(params: {
  roomId: string;
  getJoin: () => Promise<JoinResponse>;
  transport?: CollabTransport;
  field?: string;
}): Promise<CollabClient> {
  const {
    roomId,
    getJoin,
    transport = "auto",
    field = "code",
  } = params;

  // 1. Fetch join credentials from backend
  const { token, iceServers, signalingUrl, wsUrl } = await getJoin();

  // 2. Initialize Y.js document
  const doc = new Y.Doc();
  const ytext = doc.getText(field);

  // 3. Determine transport method
  let useWebRTC = transport === "webrtc" || transport === "auto";
  let provider: any;
  let actualTransport: "webrtc" | "websocket" = "webrtc";

  try {
    if (useWebRTC) {
      // Primary: WebRTC mesh (best for ≤6 peers)
      provider = new WebrtcProvider(roomId, doc, {
        // Signaling server URLs
        signaling: signalingUrl ? [signalingUrl] : [
          "wss://collab-signal.f0.app",
          "wss://y-webrtc-signaling-eu.herokuapp.com",
          "wss://y-webrtc-signaling-us.herokuapp.com"
        ],
        // JWT token for authentication
        password: token,
        // WebRTC configuration with ICE servers
        // @ts-ignore - y-webrtc types may not include peerOpts
        peerOpts: {
          config: {
            iceServers: iceServers || [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:global.stun.twilio.com:3478" }
            ]
          }
        },
        // Additional options
        maxConns: 20, // Max peer connections
        filterBcConns: true, // Filter broadcast connections
      });

      actualTransport = "webrtc";
      console.log("✅ WebRTC provider initialized for room:", roomId);
    }
  } catch (error) {
    console.warn("⚠️ WebRTC failed, falling back to WebSocket:", error);
    useWebRTC = false;
  }

  if (!useWebRTC) {
    // Fallback: WebSocket relay (scales better for large groups)
    const wsEndpoint = wsUrl || "wss://collab-ws.f0.app";
    provider = new WebsocketProvider(wsEndpoint, roomId, doc, {
      connect: true,
      // Optional: Add params for authentication
      params: { token }
    });

    actualTransport = "websocket";
    console.log("✅ WebSocket provider initialized for room:", roomId);
  }

  // 4. Get awareness (for presence/cursors)
  const awareness = provider.awareness;

  // 5. Generate unique client ID and user presence
  const id = nanoid(10);
  const color = pickStableColor();
  const name = getDisplayName();

  // 6. Initialize awareness with user presence
  awareness.setLocalStateField("user", {
    name,
    color,
    id
  });

  console.log("👤 User presence initialized:", { name, color, id });

  // 7. Setup provider event listeners with auto-reconnect
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let reconnectTimeout: NodeJS.Timeout | null = null;

  provider.on("status", (event: any) => {
    console.log("🔄 Connection status:", event.status);

    // Auto-reconnect on disconnect
    if (event.status === "disconnected" && reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000); // Exponential backoff, max 30s

      console.log(`⚠️ Disconnected. Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms...`);

      reconnectTimeout = setTimeout(() => {
        try {
          if (provider.wsconnected === false || provider.connected === false) {
            console.log("🔄 Reconnecting...");
            provider.connect?.();
          }
        } catch (error) {
          console.error("❌ Reconnect failed:", error);
        }
      }, delay);
    } else if (event.status === "connected") {
      // Reset reconnect attempts on successful connection
      reconnectAttempts = 0;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      console.log("✅ Connected successfully");
    }
  });

  provider.on("synced", (synced: boolean) => {
    if (synced) {
      console.log("✅ Document synced");
    }
  });

  // 8. Return client interface
  return {
    id,
    doc,
    ytext,
    awareness,
    provider,
    transport: actualTransport,
    reconnect: () => {
      console.log("🔄 Manual reconnect triggered");
      reconnectAttempts = 0;
      provider.connect?.();
    },
    destroy: () => {
      console.log("🗑️ Destroying collab client:", id);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      provider?.disconnect?.();
      provider?.destroy?.();
      doc.destroy();
    }
  };
}

/**
 * Helper: Generate room ID from project and file path
 */
export function generateRoomId(projectId: string, filePath: string): string {
  const normalized = filePath.replace(/[^a-zA-Z0-9]/g, "-");
  return `ide-${projectId}-${normalized}`;
}

/**
 * Helper: Check if WebRTC is supported
 */
export function isWebRTCSupported(): boolean {
  return typeof RTCPeerConnection !== "undefined";
}

/**
 * Helper: Generate a stable color for the user
 */
export function pickStableColor(): string {
  // Generate a stable color from user ID or session
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A",
    "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2",
    "#F8B739", "#52B788", "#E63946", "#457B9D"
  ];

  // Use a random index (in production, derive from user ID for stability)
  const index = Math.floor(Math.random() * colors.length);
  return colors[index];
}

/**
 * Helper: Get display name (from auth or generate)
 */
export function getDisplayName(): string {
  // In production, get from auth context
  // For now, generate a simple name
  const adjectives = ["Quick", "Smart", "Happy", "Clever", "Swift"];
  const nouns = ["Coder", "Dev", "Hacker", "Builder", "Maker"];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adj} ${noun}`;
}
