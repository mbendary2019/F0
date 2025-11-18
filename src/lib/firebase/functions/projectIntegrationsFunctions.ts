// src/lib/firebase/functions/projectIntegrationsFunctions.ts
import { getFunctions, httpsCallable } from "firebase/functions";

interface SaveProjectIntegrationsPayload {
  projectId: string;
  githubRepoUrl?: string | null;
  firebaseProjectId?: string | null;
  firebaseWebAppId?: string | null;
}

interface SaveProjectIntegrationsResponse {
  ok: boolean;
  code?: string;
  message?: string;
}

/**
 * حفظ/تحديث integrations الخاصة بالمشروع
 */
export async function saveProjectIntegrations(
  payload: SaveProjectIntegrationsPayload
): Promise<SaveProjectIntegrationsResponse> {
  try {
    const functions = getFunctions();
    const callable = httpsCallable<
      SaveProjectIntegrationsPayload,
      SaveProjectIntegrationsResponse
    >(functions, "saveProjectIntegrations");

    const result = await callable(payload);
    return result.data;
  } catch (error: any) {
    console.error("[saveProjectIntegrations] error:", error);
    return {
      ok: false,
      code: error.code || "UNKNOWN",
      message: error.message || "Failed to save project integrations",
    };
  }
}
