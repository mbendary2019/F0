"use client";

import { useEffect, useState, useCallback } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ProjectSettings } from "@/types/projects";

type State = {
  data: ProjectSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
};

export function useProjectSettings(projectId: string) {
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    saving: false,
    error: null,
  });

  useEffect(() => {
    if (!projectId) return;

    const ref = doc(db, "ops_projects", projectId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setState((s) => ({
            ...s,
            loading: false,
            data: {
              id: projectId,
              name: projectId,
              description: "",
              techStack: "",
            },
          }));
          return;
        }

        const data = snap.data() as any;

        const settings: ProjectSettings = {
          id: projectId,
          name: data.name ?? projectId,
          description: data.description ?? "",
          techStack: data.techStack ?? "",
          githubRepoUrl: data.githubRepoUrl ?? "",
          firebaseProjectId: data.firebaseProjectId ?? "",
          primaryDomain: data.primaryDomain ?? "",
          createdAt: data.createdAt ?? undefined,
          updatedAt: data.updatedAt ?? undefined,
          ownerId: data.ownerId ?? undefined,
        };

        setState((s) => ({
          ...s,
          loading: false,
          data: settings,
          error: null,
        }));
      },
      (err) => {
        console.error("useProjectSettings error", err);
        setState((s) => ({
          ...s,
          loading: false,
          error: err.message,
        }));
      }
    );

    return () => unsub();
  }, [projectId]);

  const save = useCallback(
    async (partial: Partial<ProjectSettings>) => {
      if (!projectId) return;
      setState((s) => ({ ...s, saving: true, error: null }));

      try {
        const ref = doc(db, "ops_projects", projectId);

        await setDoc(
          ref,
          {
            name: partial.name,
            description: partial.description,
            techStack: partial.techStack,
            githubRepoUrl: partial.githubRepoUrl,
            firebaseProjectId: partial.firebaseProjectId,
            primaryDomain: partial.primaryDomain,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setState((s) => ({ ...s, saving: false }));
      } catch (err: any) {
        console.error("saveProjectSettings error", err);
        setState((s) => ({
          ...s,
          saving: false,
          error: err.message ?? "Failed to save settings",
        }));
      }
    },
    [projectId]
  );

  return {
    data: state.data,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    save,
  };
}
