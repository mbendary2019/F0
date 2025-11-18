import * as functions from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { getConfig } from "../config";

const cfg = getConfig();
const stripe = new Stripe(cfg.STRIPE_SECRET_KEY);

export const createConnectAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
  const uid = request.auth.uid;
  const db = admin.firestore();
  const ref = db.collection("creators").doc(uid);
  const snap = await ref.get();

  let acctId: string | null = null;
  if (snap.exists && (snap.data() as any).stripeAccountId) {
    acctId = (snap.data() as any).stripeAccountId;
  } else {
    const acct = await stripe.accounts.create({ type: "express", metadata: { uid } });
    acctId = acct.id;
    await ref.set({ uid, stripeAccountId: acctId, updatedAt: Date.now() }, { merge: true });
  }
  return { stripeAccountId: acctId };
});

export const createAccountLink = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
  const uid = request.auth.uid;
  const db = admin.firestore();
  const doc = await db.collection("creators").doc(uid).get();
  if (!doc.exists) throw new HttpsError("failed-precondition", "Creator not found. Create account first.");

  const acctId = (doc.data() as any).stripeAccountId;
  if (!acctId) throw new HttpsError("failed-precondition", "No Stripe account ID");

  const appUrl: string = (cfg as any).APP_URL || "http://localhost:3000";
  const link = await stripe.accountLinks.create({
    account: acctId,
    refresh_url: `${appUrl}/creator/apply?refresh=1`,
    return_url: `${appUrl}/creator/dashboard`,
    type: "account_onboarding"
  });
  return { url: link.url };
});

export const createDashboardLink = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");
  const uid = request.auth.uid;
  const db = admin.firestore();
  const doc = await db.collection("creators").doc(uid).get();
  if (!doc.exists) throw new HttpsError("failed-precondition", "Creator not found.");

  const acctId = (doc.data() as any).stripeAccountId;
  if (!acctId) throw new HttpsError("failed-precondition", "No Stripe account ID");

  const link = await stripe.accounts.createLoginLink(acctId);
  return { url: link.url };
});
