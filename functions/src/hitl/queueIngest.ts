import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { applyPolicies } from "../policy/evaluate";
import { Policy } from "../policy/types";

type RunDoc = {
  uid: string;
  model: string;
  flagged: boolean;
  toxicity?: number;
  bias?: number;
  piiLeak?: boolean;
  meta?: { ts: number };
};

function reviewIdFromRunPath(path: string) {
  return crypto.createHash("sha1").update(path).digest("hex");
}

export const hitlQueueIngest = onSchedule("every 5 minutes", async () => {
  const db = admin.firestore();
  const cfgRef = db.collection("config").doc("hitl_ingest");
  const cfgSnap = await cfgRef.get();
  const lastTs =
    (cfgSnap.exists && (cfgSnap.data() as any).lastTs) ||
    Date.now() - 24 * 60 * 60 * 1000;

  const q = await db
    .collectionGroup("runs")
    .where("flagged", "==", true)
    .where("meta.ts", ">", lastTs)
    .orderBy("meta.ts", "asc")
    .limit(500)
    .get();

  if (q.empty) return;

  let maxTs = lastTs;
  for (const doc of q.docs) {
    const d = doc.data() as RunDoc;
    const ts = d?.meta?.ts || Date.now();
    if (ts > maxTs) maxTs = ts;

    const runPath = doc.ref.path;
    const reviewId = reviewIdFromRunPath(runPath);
    const reviewRef = db.collection("ai_reviews").doc(reviewId);

    const exists = await reviewRef.get();
    if (exists.exists) continue; // dedupe

    const labels: string[] = [];
    if (d.piiLeak) labels.push("pii");
    if ((d.toxicity || 0) > 0) labels.push("toxicity");
    if ((d.bias || 0) > 0) labels.push("bias");

    let severity: "low"|"med"|"high"|"critical" = d.piiLeak
      ? "critical"
      : (d.toxicity || 0) > 80
      ? "high"
      : (d.toxicity || 0) > 50 || (d.bias || 0) > 50
      ? "med"
      : "low";

    // Fetch policies
    const polSnap = await db.collection("ai_policies").where("enabled","==",true).get();
    const policies = polSnap.docs.map(x => ({ id: x.id, ...(x.data() as Policy) }) as Policy);

    // Build review draft
    const createdAt = Date.now();
    let draft = {
      uid: d.uid,
      model: d.model,
      createdAt,
      status: "queued" as const,
      severity,
      labels: [...labels],
      assignedTo: null as string|null,
      slaDueAt: createdAt + 48*60*60*1000,
      ctx: {
        toxicity: Number(d.toxicity || 0),
        bias: Number(d.bias || 0),
        piiLeak: !!d.piiLeak,
        model: d.model || "",
        labels: [...labels],
        uid: d.uid
      }
    };

    // Apply policies
    const { draft: finalDraft, applied } = applyPolicies(policies, draft);

    // Write document
    await reviewRef.set({
      ...finalDraft,
      runId: doc.id,
      runPath,
      timeline: [
        { ts: Date.now(), actor: "system", event: "ingested", diff: { flagged: d.flagged } },
        ...(applied.length ? [{ ts: Date.now(), actor: "system", event: "policy_applied", diff: { applied } }] : [])
      ],
    });
  }

  await cfgRef.set({ lastTs: maxTs }, { merge: true });
});
