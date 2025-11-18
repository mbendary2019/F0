// functions/src/integrations/githubDeploy.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { GitHubClient, parseGitHubUrl } from "./github/client";

export const triggerGitHubDeploy = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const projectId = request.data?.projectId as string | undefined;
  const env =
    (request.data?.environment as string | undefined)?.trim() || "production";

  if (!projectId) {
    throw new HttpsError("invalid-argument", "projectId is required.");
  }

  const db = getFirestore();
  const projectRef = db.collection("projects").doc(projectId);
  const snap = await projectRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Project not found.");
  }

  const project = snap.data() as any;
  if (project.ownerUid !== uid) {
    throw new HttpsError("permission-denied", "You do not own this project.");
  }

  const repoUrl: string | undefined =
    project.integrations?.github?.repoUrl || project.githubRepoUrl;

  if (!repoUrl) {
    throw new HttpsError(
      "failed-precondition",
      "GitHub repository is not connected."
    );
  }

  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new HttpsError("invalid-argument", "Invalid GitHub repo URL.");
  }

  const token = process.env.F0_GITHUB_PAT_DEV;
  if (!token) {
    logger.error("F0_GITHUB_PAT_DEV is not set");
    throw new HttpsError(
      "failed-precondition",
      "GitHub token is not configured on server."
    );
  }

  const client = new GitHubClient({
    owner: parsed.owner,
    repo: parsed.repo,
    token,
  });

  try {
    // اسم ملف الـ workflow
    const workflowId = "F0-agent.yml";

    await client.triggerWorkflow(workflowId, {
      environment: env,
      projectId,
    });

    // اختياري: نحفظ آخر deploy trigger في Firestore
    await projectRef.update({
      "integrations.github.lastDeployTrigger": {
        environment: env,
        at: new Date(),
      },
    });

    return { ok: true };
  } catch (err: any) {
    logger.error("triggerGitHubDeploy error", err);
    throw new HttpsError(
      "internal",
      err?.message || "Failed to trigger GitHub deploy"
    );
  }
});
