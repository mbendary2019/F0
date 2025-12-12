// functions/src/integrations/githubSync.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { GitHubClient, parseGitHubUrl } from "./github/client";

export const syncProjectFromGitHub = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const projectId = request.data?.projectId as string | undefined;
  if (!projectId) {
    throw new HttpsError("invalid-argument", "projectId is required.");
  }

  const token = process.env.F0_GITHUB_PAT_DEV;
  if (!token) {
    logger.error("F0_GITHUB_PAT_DEV is not set");
    throw new HttpsError(
      "failed-precondition",
      "GitHub token is not configured on server."
    );
  }

  const db = getFirestore();
  const projectRef = db.collection("projects").doc(projectId);
  const snap = await projectRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Project not found.");
  }

  const project = snap.data() as any;

  if (project.ownerUid !== uid) {
    throw new HttpsError(
      "permission-denied",
      "You do not own this project."
    );
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

  const branch = project.integrations?.github?.branch || "main";

  const client = new GitHubClient({
    owner: parsed.owner,
    repo: parsed.repo,
    token,
  });

  try {
    // نجيب آخر commit على الفرع
    const latestCommit = await client.getLatestCommit(branch);

    // نحدث بيانات المشروع في Firestore
    await projectRef.update({
      "integrations.github.lastRemoteCommit": {
        sha: latestCommit.sha,
        message: latestCommit.message,
        author: latestCommit.author,
        date: new Date(latestCommit.date),
        branch,
      },
      "integrations.github.lastSync": new Date(),
    });

    return {
      ok: true,
      commit: latestCommit,
    };
  } catch (err: any) {
    logger.error("syncProjectFromGitHub error", err);
    // لو الريبو فاضي جدًا لأي سبب
    if (
      err?.status === 409 ||
      (typeof err?.message === "string" &&
        err.message.includes("Git Repository is empty"))
    ) {
      throw new HttpsError(
        "failed-precondition",
        "GitHub repository is empty – add an initial commit first."
      );
    }

    throw new HttpsError(
      "internal",
      err?.message || "Failed to sync from GitHub"
    );
  }
});
