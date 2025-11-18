import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

const ALG_APP = process.env.ALGOLIA_APP_ID;
const ALG_KEY = process.env.ALGOLIA_ADMIN_KEY;
const ALG_INDEX = process.env.ALGOLIA_INDEX_PRODUCTS || "products_prod";

let algolia: any = null;
function getAlg() {
  if (!ALG_APP || !ALG_KEY) return null;
  if (!algolia) algolia = require("algoliasearch")(ALG_APP, ALG_KEY);
  return algolia;
}

/**
 * Auto-index products to Algolia on write
 */
export const onProductWrite = onDocumentWritten(
  "products/{id}",
  async (event) => {
    const alg = getAlg();
    if (!alg) return; // disabled, no-op

    const idx = alg.initIndex(ALG_INDEX);
    if (!event.data?.after.exists) {
      // delete
      await idx.deleteObject(event.params.id);
      return;
    }

    const d = event.data.after.data() as any;
    if (!(d.active && d.published)) {
      await idx.deleteObject(event.params.id);
      return;
    }

    await idx.saveObject({
      objectID: event.params.id,
      id: event.params.id,
      title: d.title || "",
      description: d.description || "",
      priceUsd: d.priceUsd || 0,
      ratingAvg: d.ratingAvg || 0,
      ratingCount: d.ratingCount || 0,
      slug: d.slug || "",
    });
  }
);

/**
 * Admin function to reindex all products
 */
export const reindexProducts = onCall(async (request) => {
  const t = (request.auth?.token || {}) as any;
  if (!request.auth || !t.admin) {
    throw new HttpsError("permission-denied", "Admin only");
  }
  const alg = getAlg();
  if (!alg) {
    throw new HttpsError(
      "failed-precondition",
      "Algolia not configured"
    );
  }

  const idx = alg.initIndex(ALG_INDEX);
  const db = admin.firestore();
  const snap = await db
    .collection("products")
    .where("active", "==", true)
    .where("published", "==", true)
    .limit(5000)
    .get();

  const batch = snap.docs.map((d) => ({
    objectID: d.id,
    id: d.id,
    ...d.data(),
  }));

  await idx.saveObjects(batch);
  return { indexed: batch.length };
});
