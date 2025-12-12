// functions/src/integrations/githubBranches.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { GitHubClient, parseGitHubUrl } from "./github/client";

function getGithubConfigFromProject(project: any) {
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

  const token = process.env.F0_GITHUB_PAT_DEV;
  if (!token) {
    logger.error("F0_GITHUB_PAT_DEV is not set");
    throw new HttpsError(
      "failed-precondition",
      "GitHub token is not configured on server."
    );
  }

  return {
    owner: parsed.owner,
    repo: parsed.repo,
    defaultBranch: branch,
    token,
  };
}

/**
 * إرجاع قائمة الفروع من الريبو
 */
export const listGitHubBranches = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const projectId = request.data?.projectId as string | undefined;
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

  const cfg = getGithubConfigFromProject(project);
  const client = new GitHubClient({
    owner: cfg.owner,
    repo: cfg.repo,
    token: cfg.token,
  });

  try {
    const branches = await client.listBranches();
    return {
      ok: true,
      currentBranch: project.integrations?.github?.branch || "main",
      branches,
    };
  } catch (err: any) {
    logger.error("listGitHubBranches error", err);
    throw new HttpsError(
      "internal",
      err?.message || "Failed to list GitHub branches"
    );
  }
});

/**
 * إنشاء فرع جديد + حفظه كـ currentBranch لو حابب
 */
export const createGitHubBranch = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const projectId = request.data?.projectId as string | undefined;
  const name = (request.data?.name as string | undefined)?.trim();
  const fromBranch =
    (request.data?.fromBranch as string | undefined)?.trim() || "main";
  const setAsCurrent = !!request.data?.setAsCurrent;

  if (!projectId || !name) {
    throw new HttpsError(
      "invalid-argument",
      "projectId and branch name are required."
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
    throw new HttpsError("permission-denied", "You do not own this project.");
  }

  const cfg = getGithubConfigFromProject(project);
  const client = new GitHubClient({
    owner: cfg.owner,
    repo: cfg.repo,
    token: cfg.token,
  });

  try {
    // مثال: نحط prefix للفروع اللي من F0
    const safeName = name.startsWith("f0/")
      ? name
      : `f0/${name.replace(/\s+/g, "-").toLowerCase()}`;

    const branchInfo = await client.createBranch(safeName, fromBranch);

    if (setAsCurrent) {
      await projectRef.update({
        "integrations.github.branch": safeName,
      });
    }

    return {
      ok: true,
      branch: safeName,
      sha: branchInfo.sha,
    };
  } catch (err: any) {
    logger.error("createGitHubBranch error", err);
    throw new HttpsError(
      "internal",
      err?.message || "Failed to create GitHub branch"
    );
  }
});

/**
 * تغيير الفرع الحالي في Firestore فقط
 */
export const setCurrentGitHubBranch = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const projectId = request.data?.projectId as string | undefined;
  const branch = (request.data?.branch as string | undefined)?.trim();

  if (!projectId || !branch) {
    throw new HttpsError(
      "invalid-argument",
      "projectId and branch are required."
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
    throw new HttpsError("permission-denied", "You do not own this project.");
  }

  await projectRef.update({
    "integrations.github.branch": branch,
  });

  return { ok: true, branch };
});
