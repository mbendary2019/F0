// src/lib/firebase/functions/envFunctions.ts
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type EnvVarScope = "server" | "client" | "shared";

interface SaveEnvInput {
  projectId: string;
  envVarId?: string; // If provided, update existing var
  key: string;
  value: string;
  scope: EnvVarScope;
  note?: string;
}

interface SaveEnvResult {
  envVarId: string;
}

interface DeleteEnvInput {
  projectId: string;
  envVarId: string;
}

interface DeleteEnvResult {
  success: boolean;
}

/**
 * Save or update a project environment variable
 * - Stores metadata in ops_projects/{projectId}/envVars/{envVarId}
 * - Stores actual value in vault/projects/{projectId}/envVars/{envVarId}
 */
export async function saveProjectEnvVar(
  input: SaveEnvInput
): Promise<SaveEnvResult> {
  const fn = httpsCallable<SaveEnvInput, SaveEnvResult>(
    functions,
    "saveProjectEnvVar"
  );
  const result = await fn(input);
  return result.data;
}

/**
 * Delete a project environment variable
 * - Removes both metadata and vault entry atomically
 */
export async function deleteProjectEnvVar(
  input: DeleteEnvInput
): Promise<DeleteEnvResult> {
  const fn = httpsCallable<DeleteEnvInput, DeleteEnvResult>(
    functions,
    "deleteProjectEnvVar"
  );
  const result = await fn(input);
  return result.data;
}
