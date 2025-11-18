// src/lib/collab/useCollabClient.ts
// Phase 53 Day 2: React Hook for Collaborative Client

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createCollabClient, type CollabClient, type CollabTransport } from "./createCollabClient";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";

/**
 * React hook to create and manage a collaborative editing session
 *
 * Handles:
 * - JWT token fetching from backend
 * - Y.js client initialization
 * - Automatic cleanup on unmount
 * - Connection state management
 *
 * @param roomId - Unique room identifier
 * @param projectId - Project ID for permission checks
 * @param filePath - File path being edited
 * @param options - Transport and role options
 *
 * @returns { client, loading, error, reconnect }
 */
export function useCollabClient(params: {
  roomId: string;
  projectId?: string;
  filePath?: string;
  transport?: CollabTransport;
  role?: "editor" | "viewer";
  enabled?: boolean;
}) {
  const {
    roomId,
    projectId,
    filePath,
    transport = "auto",
    role = "editor",
    enabled = true
  } = params;

  const [client, setClient] = useState<CollabClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to request room join from backend
  const getJoin = useCallback(async () => {
    try {
      const functions = getFunctions();
      const auth = getAuth();

      // Ensure user is authenticated
      if (!auth.currentUser) {
        throw new Error("User must be authenticated to join a collaboration room");
      }

      // Call backend function
      const joinFn = httpsCallable(functions, "collabRequestJoin");
      const result = await joinFn({
        roomId,
        projectId: projectId || "default",
        filePath: filePath || "untitled.tsx",
        role
      });

      const data = result.data as any;

      if (!data.success || !data.token) {
        throw new Error(data.error || "Failed to join room");
      }

      return {
        token: data.token,
        iceServers: data.iceServers,
        signalingUrl: data.signalingUrl,
        wsUrl: data.wsUrl,
        roomId: data.roomId
      };
    } catch (err: any) {
      console.error("Error requesting join:", err);
      throw new Error(err.message || "Failed to join collaboration room");
    }
  }, [roomId, projectId, filePath, role]);

  // Auto-reconnect logic with exponential backoff
  const scheduleReconnect = useCallback(() => {
    // Clear any existing timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    // Max 5 attempts
    if (reconnectAttempts >= 5) {
      console.error("Max reconnection attempts reached");
      setError(new Error("Failed to reconnect after 5 attempts"));
      return;
    }

    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 32000);

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/5)`);

    reconnectTimerRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1);
      reconnect();
    }, delay);
  }, [reconnectAttempts]);

  // Initialize client
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let currentClient: CollabClient | null = null;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setConnectionState("connecting");

        currentClient = await createCollabClient({
          roomId,
          getJoin,
          transport,
          field: "code"
        });

        if (!mounted) {
          currentClient.destroy();
          return;
        }

        setClient(currentClient);
        setConnectionState("connected");
        setLoading(false);

        // Monitor connection state
        if (currentClient.provider) {
          currentClient.provider.on?.("status", (event: any) => {
            if (event.status === "connected") {
              setConnectionState("connected");
              setReconnectAttempts(0); // Reset on successful connection
            } else if (event.status === "disconnected") {
              setConnectionState("disconnected");
              // Trigger auto-reconnect
              scheduleReconnect();
            }
          });
        }

      } catch (err: any) {
        console.error("Error creating collab client:", err);
        if (mounted) {
          setError(err);
          setLoading(false);
          setConnectionState("disconnected");
          // Schedule reconnect on error
          scheduleReconnect();
        }
      }
    })();

    return () => {
      mounted = false;
      if (currentClient) {
        currentClient.destroy();
      }
      // Clear reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [roomId, getJoin, transport, enabled]);

  // Reconnect function
  const reconnect = useCallback(async () => {
    if (client) {
      client.destroy();
      setClient(null);
    }

    setLoading(true);
    setError(null);
    setConnectionState("connecting");

    try {
      const newClient = await createCollabClient({
        roomId,
        getJoin,
        transport,
        field: "code"
      });

      setClient(newClient);
      setConnectionState("connected");
      setLoading(false);
    } catch (err: any) {
      setError(err);
      setLoading(false);
      setConnectionState("disconnected");
    }
  }, [roomId, getJoin, transport, client]);

  // Leave room on unmount
  useEffect(() => {
    return () => {
      if (client) {
        // Optionally call backend leave function
        (async () => {
          try {
            const functions = getFunctions();
            const leaveFn = httpsCallable(functions, "collabLeave");
            await leaveFn({
              roomId,
              sessionId: client.id
            });
          } catch (err) {
            console.error("Error leaving room:", err);
          }
        })();
      }
    };
  }, [client, roomId]);

  return {
    client,
    loading,
    error,
    connectionState,
    reconnect,
    reconnectAttempts
  };
}

/**
 * Simplified hook for quick testing
 */
export function useCollabClientSimple(roomId: string) {
  return useCollabClient({
    roomId,
    projectId: "test-project",
    filePath: "test-file.tsx",
    transport: "auto",
    role: "editor",
    enabled: true
  });
}
