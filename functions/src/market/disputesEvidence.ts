import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { tmpdir } from "os";
import { join } from "path";
import { promises as fs } from "fs";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || ""
);

function requireAdmin(request: CallableRequest) {
  const t = (request.auth?.token || {}) as any;
  if (!request.auth || !t.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }
}

/**
 * Submit evidence for a dispute
 * Admin can provide text and upload files from Storage to Stripe
 * Files are temporarily downloaded from GCS, uploaded to Stripe Files (purpose: dispute_evidence)
 * Then evidence is submitted to the dispute
 */
export const submitDisputeEvidence = onCall(async (request) => {
  requireAdmin(request);

  const { disputeId, text, filePaths = [] } = (request.data || {}) as {
    disputeId: string;
    text?: string;
    filePaths?: string[];
  };

  if (!disputeId) {
    throw new HttpsError("invalid-argument", "disputeId required");
  }

  const bucket = admin.storage().bucket();
  const uploaded: string[] = [];

  // Upload files from GCS to Stripe
  for (const path of filePaths) {
    try {
      const fileName = path.split("/").pop() || "evidence.bin";
      const tmp = join(tmpdir(), fileName);

      // Download from GCS
      await bucket.file(path).download({ destination: tmp });

      // Read file and upload to Stripe
      const fileBuffer = await fs.readFile(tmp);
      const file = await stripe.files.create({
        purpose: "dispute_evidence",
        file: {
          data: fileBuffer,
          name: fileName,
          type: "application/octet-stream",
        },
      } as any);

      uploaded.push(file.id);

      // Cleanup temp file
      await fs.unlink(tmp).catch(() => {});
    } catch (err: any) {
      console.error(`Failed to upload file ${path}:`, err.message);
    }
  }

  // Build evidence object
  const evidence: any = {};
  if (text) {
    evidence.customer_communication = text.slice(0, 60000); // Stripe limit
  }
  if (uploaded.length) {
    evidence.uncategorized_file = uploaded[uploaded.length - 1];
  }

  // Update evidence if we have anything
  if (Object.keys(evidence).length) {
    try {
      await stripe.disputes.update(disputeId, {
        evidence,
        submit: true
      } as any);
    } catch (err: any) {
      console.error(`Failed to submit dispute evidence:`, err.message);
      throw new HttpsError(
        "internal",
        `Failed to submit evidence: ${err.message}`
      );
    }
  }

  // Log evidence submission to Firestore
  const db = admin.firestore();
  await db
    .collection("disputes")
    .doc(disputeId)
    .collection("evidence")
    .add({
      ts: Date.now(),
      by: request.auth?.uid,
      text: text || null,
      stripeFiles: uploaded,
    });

  await db.collection("audit_logs").add({
    ts: Date.now(),
    kind: "dispute_evidence_submitted",
    actor: request.auth?.uid,
    meta: { disputeId, filesCount: uploaded.length },
  });

  return { ok: true, uploadedCount: uploaded.length };
});
