// Stripe Webhook Handler - Add FZ balance after subscription
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { 
  apiVersion: "2024-06-20" 
});

async function getRawBody(req: Request): Promise<Buffer> {
  const arr = await req.arrayBuffer();
  return Buffer.from(arr);
}

async function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  return admin.firestore();
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  const raw = await getRawBody(req as unknown as Request);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { ok: false, error: `Invalid signature: ${err.message}` },
      { status: 400 }
    );
  }

  console.log("Webhook event received:", event.type);

  if (event.type === "checkout.session.completed") {
    const db = await initAdmin();
    const session = event.data.object as Stripe.Checkout.Session;

    // Get user identifier from metadata or customer email
    const uid = (session.metadata?.uid as string) || "";
    const email = (session.customer_details?.email as string) || "";

    // Calculate FZ to add
    const usd = Number(process.env.SUB_PRICE_USD || 29);
    const rate = Number(process.env.FZ_RATE_PER_USD || 1);
    const fz = usd * rate;

    console.log(`Adding ${fz} FZ for user:`, uid || email);

    // Add FZ balance
    const addFZ = async (docRef: FirebaseFirestore.DocumentReference) => {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        const prev = (snap.get("balances.fz") as number) || 0;
        const newBalance = prev + fz;
        
        tx.set(
          docRef,
          {
            balances: { fz: newBalance },
            subscriptions: {
              stripe: {
                sessionId: session.id,
                customerId: session.customer,
                status: "active",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
            },
          },
          { merge: true }
        );

        console.log(`Updated balance: ${prev} → ${newBalance} FZ`);
      });
    };

    try {
      if (uid) {
        // Direct UID lookup
        const userRef = db.collection("users").doc(uid);
        await addFZ(userRef);
      } else if (email) {
        // Email lookup
        const query = db.collection("users").where("email", "==", email).limit(1);
        const snapshot = await query.get();
        
        if (!snapshot.empty) {
          await addFZ(snapshot.docs[0].ref);
        } else {
          console.error("User not found for email:", email);
          return NextResponse.json(
            { ok: false, error: "User not found" },
            { status: 404 }
          );
        }
      } else {
        console.error("No UID or email provided in session");
        return NextResponse.json(
          { ok: false, error: "No user identifier" },
          { status: 400 }
        );
      }
    } catch (err: any) {
      console.error("Error updating user balance:", err);
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, received: true });
}


