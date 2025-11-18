// functions/src/projects/env.ts
import * as logger from "firebase-functions/logger";
import { onCall } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

interface SaveEnvVarData {
  projectId: string;
  key: string;
  value: string;
  visibility: "server" | "client";
}

interface GetEnvVarsData {
  projectId: string;
}

interface DeleteEnvVarData {
  projectId: string;
  key: string;
}

// 🔹 Helper – يرجّع الريفرنس الصحيح لمكان تخزين المتغيّرات
function envVarsCollection(projectId: string) {
  const db = getFirestore();
  return db.collection("ops_projects").doc(projectId).collection("envVars");
}

// 🔹 Helper – نتأكد إن في project doc موجود
async function assertProjectExists(projectId: string) {
  const db = getFirestore();
  const snap = await db.collection("ops_projects").doc(projectId).get();
  if (!snap.exists) {
    throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
  }
}

/**
 * getProjectEnvVars
 * يرجّع كل المتغيّرات لمشروع معيّن
 */
export const getProjectEnvVars = onCall<GetEnvVarsData>(async (request) => {
  try {
    const { projectId } = request.data;

    if (!projectId) {
      throw new Error("MISSING_PROJECT_ID");
    }

    // في الإيموليتر ما نحتاج نكلم Google APIs خالص
    await assertProjectExists(projectId);

    const col = envVarsCollection(projectId);
    const snap = await col.get();

    const envVars = snap.docs.map((doc) => ({
      key: doc.id,
      ...(doc.data() as any),
    }));

    return { ok: true, envVars };
  } catch (err: any) {
    logger.error("[getProjectEnvVars] error", err);
    if (typeof err.message === "string" && err.message.startsWith("PROJECT_NOT_FOUND")) {
      return { ok: false, code: "PROJECT_NOT_FOUND", message: "Project not found" };
    }
    return { ok: false, code: "INTERNAL", message: "Internal error" };
  }
});

/**
 * saveProjectEnvVar
 * حفظ / تحديث متغيّر بيئة واحد
 */
export const saveProjectEnvVar = onCall<SaveEnvVarData>(async (request) => {
  try {
    const { projectId, key, value, visibility } = request.data;

    if (!request.auth) {
      throw new Error("UNAUTHENTICATED");
    }

    if (!projectId || !key) {
      throw new Error("MISSING_PARAMS");
    }

    await assertProjectExists(projectId);

    const col = envVarsCollection(projectId);
    const docRef = col.doc(key);

    await docRef.set(
      {
        value,
        visibility,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return { ok: true };
  } catch (err: any) {
    logger.error("[saveProjectEnvVar] error", err);

    if (err.message === "UNAUTHENTICATED") {
      return { ok: false, code: "UNAUTHENTICATED", message: "Authentication required" };
    }
    if (err.message === "MISSING_PARAMS") {
      return { ok: false, code: "INVALID_ARGUMENT", message: "Missing projectId or key" };
    }
    if (typeof err.message === "string" && err.message.startsWith("PROJECT_NOT_FOUND")) {
      return { ok: false, code: "PROJECT_NOT_FOUND", message: "Project not found" };
    }

    return { ok: false, code: "INTERNAL", message: "Internal error" };
  }
});

/**
 * deleteProjectEnvVar
 */
export const deleteProjectEnvVar = onCall<DeleteEnvVarData>(async (request) => {
  try {
    const { projectId, key } = request.data;

    if (!request.auth) {
      throw new Error("UNAUTHENTICATED");
    }
    if (!projectId || !key) {
      throw new Error("MISSING_PARAMS");
    }

    await assertProjectExists(projectId);

    const col = envVarsCollection(projectId);
    await col.doc(key).delete();

    return { ok: true };
  } catch (err: any) {
    logger.error("[deleteProjectEnvVar] error", err);
    return { ok: false, code: "INTERNAL", message: "Internal error" };
  }
});
