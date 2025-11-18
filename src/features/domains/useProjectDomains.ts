"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type ProjectDomain = {
  id: string;
  domain: string;
  subdomain: string;
  provider: "vercel" | "firebase" | "custom";
  targetHost: string;
  status: "pending" | "active" | "error";
  lastError?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

type State = {
  domains: ProjectDomain[];
  loading: boolean;
  error: string | null;
};

/**
 * Custom hook to fetch and manage saved domain configurations for a project
 * Uses Firestore realtime listener for instant updates
 */
export function useProjectDomains(projectId: string | null | undefined) {
  const [state, setState] = useState<State>({
    domains: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!projectId) {
      setState({ domains: [], loading: false, error: null });
      return;
    }

    const colRef = collection(db, "projects", projectId, "domains");
    const q = query(colRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const domains: ProjectDomain[] = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            domain: data.domain,
            subdomain: data.subdomain ?? "",
            provider: data.provider,
            targetHost: data.targetHost,
            status: data.status ?? "pending",
            lastError: data.lastError ?? null,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });

        setState({ domains, loading: false, error: null });
      },
      (err) => {
        console.error("[useProjectDomains] Error:", err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to load domains",
        }));
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  return state;
}
