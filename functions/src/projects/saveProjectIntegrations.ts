// functions/src/projects/saveProjectIntegrations.ts
import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

interface SaveProjectIntegrationsData {
  projectId: string;
  githubRepoUrl?: string | null;
  firebaseProjectId?: string | null;
  firebaseWebAppId?: string | null;
}

/**
 * saveProjectIntegrations
 * حفظ/تحديث integrations الخاصة بمشروع (GitHub repo, Firebase project, etc.)
 */
export const saveProjectIntegrations = onCall<SaveProjectIntegrationsData>(
  async (request) => {
    try {
      const { projectId, githubRepoUrl, firebaseProjectId, firebaseWebAppId } =
        request.data;

      // التأكد من المصادقة
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required");
      }

      if (!projectId) {
        throw new HttpsError("invalid-argument", "Missing projectId");
      }

      const db = getFirestore();

      // التحقق من ملكية المشروع - يجب القراءة من projects وليس ops_projects
      const projectRef = db.collection("projects").doc(projectId);
      const snap = await projectRef.get();

      if (!snap.exists) {
        throw new HttpsError("not-found", "Project does not exist");
      }

      const data = snap.data();

      if (data?.ownerUid !== request.auth.uid) {
        throw new HttpsError(
          "permission-denied",
          "You do not have permission to modify this project"
        );
      }

      // بناء الـ integrations object
      const integrations: any = {};

      if (githubRepoUrl !== undefined) {
        integrations["integrations.github.repoUrl"] = githubRepoUrl;
      }

      if (firebaseProjectId !== undefined) {
        integrations["integrations.firebase.projectId"] = firebaseProjectId;
      }

      if (firebaseWebAppId !== undefined) {
        integrations["integrations.firebase.webAppId"] = firebaseWebAppId;
      }

      // تحديث في projects (المصدر الأساسي)
      await projectRef.update({
        ...integrations,
        updatedAt: new Date(),
      });

      // تحديث في ops_projects أيضاً
      const opsProjectRef = db.collection("ops_projects").doc(projectId);
      const opsSnap = await opsProjectRef.get();

      if (opsSnap.exists) {
        await opsProjectRef.update({
          ...integrations,
          updatedAt: new Date(),
        });
      }

      logger.info(
        `[saveProjectIntegrations] Updated integrations for project ${projectId}`
      );

      return { ok: true };
    } catch (err: any) {
      logger.error("[saveProjectIntegrations] error", err);

      // HttpsError will be automatically handled by Firebase
      // Just re-throw it
      if (err instanceof HttpsError) {
        throw err;
      }

      // For any other errors, wrap in INTERNAL error
      throw new HttpsError("internal", err.message || "Internal error");
    }
  }
);
