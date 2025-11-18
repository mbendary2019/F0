/**
 * Phase 36 - Policy Updater
 * Manages policy versions and activation
 */

import * as admin from "firebase-admin";
import { FLAGS } from "../config/flags";
import { PolicyDoc, CandidatePolicyInput, AuditLog } from "../types/learning";

const db = admin.firestore();

/**
 * Propose a new policy version based on current policy
 */
export async function proposePolicy({
  id,
  currentVersion,
  tweak,
  note,
}: CandidatePolicyInput): Promise<{ id: string; version: string }> {
  try {
    const activeRef = db
      .collection("ops_policies")
      .doc(`${id}@${currentVersion}`);
    const activeSnap = await activeRef.get();

    if (!activeSnap.exists) {
      throw new Error(`Active policy ${id}@${currentVersion} not found`);
    }

    const active = activeSnap.data() as PolicyDoc;

    // Bump version
    const nextVersion = bumpPatch(currentVersion);
    const draftRef = db.collection("ops_policies").doc(`${id}@${nextVersion}`);

    // Create draft policy
    const draftPolicy: PolicyDoc = {
      id,
      version: nextVersion,
      status: "draft",
      createdAt: Date.now(),
      createdBy: "policy-updater",
      notes: note || `Auto-tuned from ${currentVersion}`,
      params: tweak(active.params || {}),
      flags: active.flags || {},
    };

    await draftRef.set(draftPolicy);

    // Create audit log
    const auditLog: AuditLog = {
      ts: Date.now(),
      actor: "policy-updater",
      action: "propose",
      id,
      from: currentVersion,
      to: nextVersion,
      note,
    };

    await db.collection("ops_audit").add(auditLog);

    console.log("[PolicyUpdater] Proposed new policy:", {
      id,
      from: currentVersion,
      to: nextVersion,
      note,
    });

    // Auto-activate if flags are set
    if (FLAGS.learning.enabled && FLAGS.learning.autoActivatePolicies) {
      await activatePolicy(id, nextVersion, "auto");
    }

    return { id, version: nextVersion };
  } catch (error) {
    console.error("[PolicyUpdater] Error proposing policy:", error);
    throw error;
  }
}

/**
 * Activate a policy version
 */
export async function activatePolicy(
  id: string,
  version: string,
  actor: string = "admin"
): Promise<void> {
  try {
    const ref = db.collection("ops_policies").doc(`${id}@${version}`);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new Error(`Policy ${id}@${version} not found`);
    }

    const policy = doc.data() as PolicyDoc;

    if (policy.status === "active") {
      console.log(
        `[PolicyUpdater] Policy ${id}@${version} already active`
      );
      return;
    }

    // Archive current active version
    const activeSnap = await db
      .collection("ops_policies")
      .where("id", "==", id)
      .where("status", "==", "active")
      .get();

    await Promise.all(
      activeSnap.docs.map((doc) =>
        doc.ref.update({ status: "archived" })
      )
    );

    // Activate new version
    await ref.update({ status: "active" });

    // Create audit log
    const auditLog: AuditLog = {
      ts: Date.now(),
      actor,
      action: "activate",
      id,
      to: version,
    };

    await db.collection("ops_audit").add(auditLog);

    console.log("[PolicyUpdater] Activated policy:", {
      id,
      version,
      actor,
    });
  } catch (error) {
    console.error("[PolicyUpdater] Error activating policy:", error);
    throw error;
  }
}

/**
 * Archive a policy version
 */
export async function archivePolicy(
  id: string,
  version: string,
  actor: string = "admin"
): Promise<void> {
  const ref = db.collection("ops_policies").doc(`${id}@${version}`);
  await ref.update({ status: "archived" });

  const auditLog: AuditLog = {
    ts: Date.now(),
    actor,
    action: "archive",
    id,
    to: version,
  };

  await db.collection("ops_audit").add(auditLog);

  console.log("[PolicyUpdater] Archived policy:", { id, version, actor });
}

/**
 * Get active policy for a component
 */
export async function getActivePolicy(id: string): Promise<PolicyDoc | null> {
  const snap = await db
    .collection("ops_policies")
    .where("id", "==", id)
    .where("status", "==", "active")
    .limit(1)
    .get();

  return snap.empty ? null : (snap.docs[0].data() as PolicyDoc);
}

/**
 * Get all policies for a component
 */
export async function getPolicies(id: string): Promise<PolicyDoc[]> {
  const snap = await db
    .collection("ops_policies")
    .where("id", "==", id)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((doc) => doc.data() as PolicyDoc);
}

/**
 * Bump patch version (e.g., 1.0.0 -> 1.0.1)
 */
function bumpPatch(v: string): string {
  const [maj, min, pat] = v.split(".").map(Number);
  return `${maj}.${min}.${(pat || 0) + 1}`;
}

/**
 * Rollback to a previous policy version
 */
export async function rollbackPolicy(
  id: string,
  targetVersion: string,
  actor: string = "admin"
): Promise<void> {
  try {
    const ref = db.collection("ops_policies").doc(`${id}@${targetVersion}`);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new Error(`Policy ${id}@${targetVersion} not found`);
    }

    const policy = doc.data() as PolicyDoc;

    if (policy.status === "archived") {
      // Reactivate archived version
      await activatePolicy(id, targetVersion, actor);

      const auditLog: AuditLog = {
        ts: Date.now(),
        actor,
        action: "rollback",
        id,
        to: targetVersion,
        note: `Rolled back to ${targetVersion}`,
      };

      await db.collection("ops_audit").add(auditLog);

      console.log("[PolicyUpdater] Rolled back policy:", {
        id,
        to: targetVersion,
        actor,
      });
    } else {
      console.log(`[PolicyUpdater] Policy ${id}@${targetVersion} already active or draft`);
    }
  } catch (error) {
    console.error("[PolicyUpdater] Error rolling back policy:", error);
    throw error;
  }
}
