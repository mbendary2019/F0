import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

export const onPreflightCheck = functions.https.onCall(async (data: any, context: any) => {
  const { projectId } = data;
  const missing: string[] = [];

  // التحقق من المفاتيح الأساسية
  if (!process.env.OPENAI_API_KEY) {
    missing.push("OPENAI_API_KEY");
  }
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    missing.push("FIREBASE_API_KEY");
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    missing.push("STRIPE_SECRET_KEY");
  }

  // التحقق من المستخدم (skip in emulator for development)
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  if (!context.auth?.uid && !isEmulator) {
    missing.push("AUTH_USER_MISSING");
  }

  // إنشاء activity log في المشروع
  if (projectId) {
    try {
      const projectRef = db.doc(`projects/${projectId}`);
      await projectRef.collection("activity").add({
        type: "preflight",
        status: missing.length ? "failed" : "passed",
        missing,
        user: context.auth?.uid || "anonymous",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to log preflight activity:", e);
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    message: missing.length
      ? `❌ Missing environment keys: ${missing.join(", ")}`
      : "✅ Preflight checks passed successfully",
  };
});
