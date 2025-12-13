import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { VerifiedRegistrationResponse } from "@simplewebauthn/server";
import { adminAuth, adminDb } from "@/server/firebaseAdmin";

export const dynamic = 'force-dynamic';

type RegistrationResponseJSON = any;

export const runtime = "nodejs";

/**
 * POST /api/webauthn/registration/verify
 * Verify passkey registration and store credential
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken, attResp } = await req.json();

    if (!idToken || !attResp) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify Firebase ID token
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // Get stored challenge
    const stateRef = adminDb.doc(`users/${uid}/webauthn_state/state`);
    const stateSnap = await stateRef.get();

    if (!stateSnap.exists) {
      return NextResponse.json(
        { error: "No challenge found. Please start registration again." },
        { status: 400 }
      );
    }

    const expectedChallenge = stateSnap.get("currentRegChallenge");

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Challenge expired. Please try again." },
        { status: 400 }
      );
    }

    const rpID = process.env.NEXT_PUBLIC_RP_ID!;
    const origin = process.env.ORIGIN!;

    // Verify registration response
    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: attResp as RegistrationResponseJSON,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch (error: any) {
      console.error("Registration verification failed:", error);
      return NextResponse.json(
        { error: "Verification failed: " + error.message },
        { status: 400 }
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    const {
      credentialID,
      credentialPublicKey,
      counter,
      credentialBackedUp,
      credentialDeviceType,
    } = verification.registrationInfo;

    // Convert credentialID to base64url for storage
    const credIdB64 = Buffer.from(credentialID).toString("base64url");

    // Store credential in Firestore
    await adminDb.doc(`users/${uid}/passkeys/${credIdB64}`).set({
      id: credIdB64,
      publicKey: Buffer.from(credentialPublicKey).toString("base64"),
      counter,
      backedUp: credentialBackedUp,
      deviceType: credentialDeviceType,
      transports: attResp.response?.transports || [],
      createdAt: new Date(),
      lastUsedAt: new Date(),
      userAgent: req.headers.get("user-agent") || "Unknown",
    });

    // Clean up challenge
    await stateRef.set(
      {
        currentRegChallenge: null,
      },
      { merge: true }
    );

    console.log(`✅ Passkey registered for user ${uid}: ${credIdB64}`);

    return NextResponse.json(
      {
        ok: true,
        id: credIdB64,
        message: "Passkey registered successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[/api/webauthn/registration/verify] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed" },
    { status: 405 }
  );
}
