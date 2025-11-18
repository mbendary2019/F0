import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

export const generateDownloadUrl = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

  const { productId } = request.data || {};
  if (!productId) throw new HttpsError("invalid-argument", "productId required");

  const db = admin.firestore();

  // Verify license ownership
  const licSnap = await db.collection("licenses")
    .where("uid", "==", request.auth.uid)
    .where("productId", "==", productId)
    .limit(1)
    .get();

  if (licSnap.empty) throw new HttpsError("permission-denied", "No license");

  // Resolve product assetPath
  const prod = await db.collection("products").doc(productId).get();
  if (!prod.exists) throw new HttpsError("not-found", "Product not found");
  const p = prod.data() as any;
  const path = p.assetPath as string;
  if (!path) throw new HttpsError("failed-precondition", "Product asset missing");

  // Signed URL (e.g., 60 minutes)
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 60 * 60 * 1000
  });

  // Update license usage
  await licSnap.docs[0].ref.set({ lastDownloadAt: Date.now(), downloadCount: admin.firestore.FieldValue.increment(1) }, { merge: true });

  return { url };
});
