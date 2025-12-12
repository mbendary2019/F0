// src/lib/opsClient.ts
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { app } from "@/lib/firebase";

// Type helpers
export type DeploymentEnv = "production" | "preview";
export type DeploymentStatus = "success" | "failed" | "in_progress";

export interface OpsDeployment {
  id: string;
  ownerUid: string;
  projectId: string;
  projectName: string;
  label: string;
  env: DeploymentEnv;
  status: DeploymentStatus;
  provider: "vercel" | "github-actions";
  branch: string;
  createdAt: Date | null;
  finishedAt: Date | null;
  url: string | null;
  logsUrl: string | null;
}

export interface OpsAiLog {
  id: string;
  ownerUid: string;
  projectId: string;
  projectName: string;
  type: "plan" | "patch" | "analysis";
  description: string;
  status: "success" | "applied" | "info" | "failed";
  createdAt: Date | null;
}

export interface OpsActivityEvent {
  id: string;
  ownerUid: string;
  projectId: string;
  projectName: string;
  actor: "You" | "F0 Agent" | "System";
  label: string;
  category: "live_coding" | "agent" | "deploy";
  createdAt: Date | null;
}

// Helper to normalize Firestore Timestamp / number / string
function toDateSafe(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "number") return new Date(value);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ============= Deployments =============
export async function fetchDeploymentsForUser(
  uid: string,
  opts?: { projectId?: string }
): Promise<OpsDeployment[]> {
  const db = getFirestore(app);
  let base = collection(db, "ops_deployments");

  const q = opts?.projectId
    ? query(base, where("ownerUid", "==", uid), where("projectId", "==", opts.projectId), orderBy("createdAt", "desc"))
    : query(base, where("ownerUid", "==", uid), orderBy("createdAt", "desc"));

  const snap = await getDocs(q);

  return snap.docs.map((doc) => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      ownerUid: data.ownerUid ?? "",
      projectId: data.projectId ?? "",
      projectName: data.projectName ?? "",
      label: data.label ?? "",
      env: data.env ?? "production",
      status: data.status ?? "success",
      provider: data.provider ?? "vercel",
      branch: data.branch ?? "main",
      createdAt: toDateSafe(data.createdAt),
      finishedAt: toDateSafe(data.finishedAt),
      url: data.url ?? null,
      logsUrl: data.logsUrl ?? null,
    } satisfies OpsDeployment;
  });
}

// ============= AI Logs =============
export async function fetchAiLogsForUser(
  uid: string,
  opts?: { limit?: number }
): Promise<OpsAiLog[]> {
  const db = getFirestore(app);
  const base = collection(db, "ops_aiLogs");

  const q = query(
    base,
    where("ownerUid", "==", uid),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);
  const docs = snap.docs.slice(0, opts?.limit ?? snap.docs.length);

  return docs.map((doc) => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      ownerUid: data.ownerUid ?? "",
      projectId: data.projectId ?? "",
      projectName: data.projectName ?? "",
      type: data.type ?? "plan",
      description: data.description ?? "",
      status: data.status ?? "success",
      createdAt: toDateSafe(data.createdAt),
    } satisfies OpsAiLog;
  });
}

// ============= Activity History =============
export async function fetchActivityForUser(
  uid: string,
  opts?: { limit?: number }
): Promise<OpsActivityEvent[]> {
  const db = getFirestore(app);
  const base = collection(db, "ops_activity");

  const q = query(
    base,
    where("ownerUid", "==", uid),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);
  const docs = snap.docs.slice(0, opts?.limit ?? snap.docs.length);

  return docs.map((doc) => {
    const data = doc.data() as any;
    return {
      id: doc.id,
      ownerUid: data.ownerUid ?? "",
      projectId: data.projectId ?? "",
      projectName: data.projectName ?? "",
      actor: (data.actor ?? "You") as OpsActivityEvent["actor"],
      label: data.label ?? "",
      category: (data.category ?? "agent") as OpsActivityEvent["category"],
      createdAt: toDateSafe(data.createdAt),
    } satisfies OpsActivityEvent;
  });
}
