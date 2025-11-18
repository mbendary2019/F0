// API endpoint to check user balance and profile
import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";

async function initAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  return admin.firestore();
}

export async function GET(req: NextRequest) {
  try {
    const db = await initAdmin();
    
    // Get UID from query param or use dev UID
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get("uid") || "DEV_UID_123";

    console.log(`Fetching user data for: ${uid}`);

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      // Create a demo user if not exists
      const demoUser = {
        uid,
        email: "dev@example.com",
        displayName: "Dev User",
        balances: {
          fz: 0,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      await userRef.set(demoUser);
      
      return NextResponse.json({
        ok: true,
        data: demoUser,
        message: "Demo user created",
      });
    }

    const userData = userSnap.data();

    return NextResponse.json({
      ok: true,
      data: {
        uid: userSnap.id,
        email: userData?.email || null,
        displayName: userData?.displayName || null,
        balances: userData?.balances || { fz: 0 },
        subscriptions: userData?.subscriptions || null,
        createdAt: userData?.createdAt || null,
      },
    });
  } catch (error: any) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// POST endpoint to update balance (for testing)
export async function POST(req: NextRequest) {
  try {
    const db = await initAdmin();
    const body = await req.json();
    
    const { uid = "DEV_UID_123", fz } = body;

    if (typeof fz !== "number") {
      return NextResponse.json(
        { ok: false, error: "Invalid FZ amount" },
        { status: 400 }
      );
    }

    const userRef = db.collection("users").doc(uid);
    
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const current = snap.get("balances.fz") || 0;
      
      tx.set(
        userRef,
        {
          balances: { fz: current + fz },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    // Get updated data
    const updated = await userRef.get();
    
    return NextResponse.json({
      ok: true,
      data: updated.data(),
      message: `Added ${fz} FZ to balance`,
    });
  } catch (error: any) {
    console.error("Error updating balance:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
