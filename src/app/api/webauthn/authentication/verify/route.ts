import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { VerifiedAuthenticationResponse } from "@simplewebauthn/server";
import { adminAuth, adminDb } from "@/server/firebaseAdmin";

type AuthenticationResponseJSON = any;

export const runtime = "nodejs";

/**
 * POST /api/webauthn/authentication/verify
 * Verify passkey authentication and issue Firebase custom token
 */
export async function POST(req: NextRequest) {
  try {
    const { challengeId, assertion } = await req.json();

    if (!challengeId || !assertion) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get stored challenge
    const challengeRef = adminDb.doc(`webauthn_challenges/${challengeId}`);
    const challengeSnap = await challengeRef.get();

    if (!challengeSnap.exists) {
      return NextResponse.json(
        { error: "Challenge not found or expired" },
        { status: 400 }
      );
    }

    const expectedChallenge = challengeSnap.get("challenge");

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: "Invalid challenge" },
        { status: 400 }
      );
    }

    // Get credential ID from assertion
    const credIdB64 = assertion.id; // base64url format

    // Find the passkey owner using collection group query
    const passkeysQuery = await adminDb
      .collectionGroup("passkeys")
      .where("id", "==", credIdB64)
      .get();

    if (passkeysQuery.empty) {
      return NextResponse.json(
        { error: "Unknown credential" },
        { status: 400 }
      );
    }

    // Get the first (and should be only) matching passkey
    const passkeyDoc = passkeysQuery.docs[0];
    const passkeyData = passkeyDoc.data();

    // Extract uid from document path: users/{uid}/passkeys/{credId}
    const uid = passkeyDoc.ref.parent.parent!.id;

    const rpID = process.env.NEXT_PUBLIC_RP_ID!;
    const origin = process.env.ORIGIN!;

    // Verify authentication response
    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertion as AuthenticationResponseJSON,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: Buffer.from(credIdB64, "base64url"),
          credentialPublicKey: Buffer.from(passkeyData.publicKey, "base64"),
          counter: passkeyData.counter || 0,
          transports: passkeyData.transports || [],
        },
        requireUserVerification: true,
      });
    } catch (error: any) {
      console.error("Authentication verification failed:", error);
      return NextResponse.json(
        { error: "Verification failed: " + error.message },
        { status: 400 }
      );
    }

    if (!verification.verified || !verification.authenticationInfo) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    const { newCounter } = verification.authenticationInfo;

    // Update passkey counter and last used timestamp
    await passkeyDoc.ref.set(
      {
        counter: newCounter,
        lastUsedAt: new Date(),
      },
      { merge: true }
    );

    // Delete the challenge
    await challengeRef.delete();

    // Create Firebase custom token for the user
    const customToken = await adminAuth.createCustomToken(uid);

    console.log(`✅ Passkey authentication successful for user ${uid}`);

    return NextResponse.json(
      {
        ok: true,
        uid,
        customToken,
        message: "Authentication successful",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[/api/webauthn/authentication/verify] Error:", error);
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
