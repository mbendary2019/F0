import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { randomBytes, createHmac } from "crypto";
import { getConfig } from "./config";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/** Generate API key hash */
function hashKey(key: string): string {
  const { API_KEY_HASH_SECRET } = getConfig();
  return createHmac("sha256", API_KEY_HASH_SECRET).update(key).digest("hex");
}

/** Callable: Create new API key for current user */
export const createApiKey = onCall<{ name: string; scopes: string[] }>(async (req) => {
  const uid = req.auth?.uid || "demo-user";
  const { name, scopes } = req.data;

  // Generate unique API key
  const plainKey = `f0_${randomBytes(16).toString("hex")}_${randomBytes(8).toString("hex")}`;
  const hash = hashKey(plainKey);

  // Save to Firestore
  const docRef = await db.collection("api_keys").add({
    uid,
    name: name || "Unnamed Key",
    scopes: scopes || ["read"],
    hash,
    active: true,
    createdAt: new Date(),
    lastUsed: null,
  });

  return {
    id: docRef.id,
    apiKey: plainKey,
    name: name || "Unnamed Key",
    scopes: scopes || ["read"],
  };
});

/** Callable: List all API keys for current user */
export const listApiKeys = onCall(async (req) => {
  const uid = req.auth?.uid || "demo-user";

  const snapshot = await db.collection("api_keys")
    .where("uid", "==", uid)
    .where("active", "==", true)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.get("name"),
    scopes: doc.get("scopes"),
    createdAt: doc.get("createdAt")?.toDate()?.toISOString() || null,
    lastUsed: doc.get("lastUsed")?.toDate()?.toISOString() || null,
  }));
});

/** Callable: Revoke (soft delete) an API key */
export const revokeApiKey = onCall<{ keyId: string }>(async (req) => {
  const uid = req.auth?.uid || "demo-user";
  const { keyId } = req.data;

  if (!keyId) {
    throw new HttpsError("invalid-argument", "keyId is required");
  }

  const docRef = db.collection("api_keys").doc(keyId);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new HttpsError("not-found", "API key not found");
  }

  if (doc.get("uid") !== uid) {
    throw new HttpsError("permission-denied", "Not your key");
  }

  await docRef.update({
    active: false,
    revokedAt: new Date(),
  });

  return { ok: true, id: keyId };
});
