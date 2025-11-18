"use client";

import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { EnvVarScope } from "@/lib/firebase/functions/envFunctions";
import {
  saveProjectEnvVar as saveEnvVarFn,
  deleteProjectEnvVar as deleteEnvVarFn,
} from "@/lib/firebase/functions/envFunctions";

export type ProjectEnvVar = {
  id: string;
  key: string;
  scope: EnvVarScope;
  note: string;
  vaultPath: string;
  last4?: string; // Last 4 chars of value (for display)
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
};

type State = {
  items: ProjectEnvVar[];
  loading: boolean;
  error: string | null;
  saving: boolean;
};

export function useProjectEnvVars(projectId: string) {
  const [state, setState] = useState<State>({
    items: [],
    loading: true,
    error: null,
    saving: false,
  });

  // Listen to metadata subcollection
  useEffect(() => {
    if (!projectId) return;

    const col = collection(db, "ops_projects", projectId, "envVars");
    const q = query(col, orderBy("key"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: ProjectEnvVar[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          items.push({
            id: docSnap.id,
            key: data.key,
            scope: (data.scope ?? "server") as EnvVarScope,
            note: data.note || "",
            vaultPath: data.vaultPath || "",
            last4: data.last4,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy,
          });
        });

        setState((s) => ({
          ...s,
          items,
          loading: false,
          error: null,
        }));
      },
      (err) => {
        console.error("useProjectEnvVars error", err);
        setState((s) => ({
          ...s,
          loading: false,
          error: err.message,
        }));
      }
    );

    return () => unsub();
  }, [projectId]);

  const saveVar = useCallback(
    async (
      key: string,
      value: string,
      scope: EnvVarScope,
      note?: string,
      envVarId?: string
    ) => {
      if (!projectId || !key) return;
      setState((s) => ({ ...s, saving: true }));

      try {
        await saveEnvVarFn({
          projectId,
          envVarId,
          key,
          value,
          scope,
          note,
        });

        setState((s) => ({ ...s, saving: false }));
      } catch (err: any) {
        console.error("saveVar error", err);
        setState((s) => ({
          ...s,
          saving: false,
          error: err.message ?? "Failed to save env var",
        }));
        throw err;
      }
    },
    [projectId]
  );

  const deleteVar = useCallback(
    async (id: string) => {
      if (!projectId || !id) return;
      setState((s) => ({ ...s, saving: true }));

      try {
        await deleteEnvVarFn({
          projectId,
          envVarId: id,
        });

        setState((s) => ({ ...s, saving: false }));
      } catch (err: any) {
        console.error("deleteVar error", err);
        setState((s) => ({
          ...s,
          saving: false,
          error: err.message ?? "Failed to delete env var",
        }));
        throw err;
      }
    },
    [projectId]
  );

  return {
    ...state,
    saveVar,
    deleteVar,
  };
}
