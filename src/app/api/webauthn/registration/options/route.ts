import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { adminAuth, adminDb } from "@/server/firebaseAdmin";

export const runtime = "nodejs";

/**
 * POST /api/webauthn/registration/options
 * Generate registration options for WebAuthn passkey enrollment
 */
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "Missing idToken" },
        { status: 400 }
      );
    }

    // Verify Firebase ID token
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const rpID = process.env.NEXT_PUBLIC_RP_ID!;
    const rpName = process.env.NEXT_PUBLIC_RP_NAME || "F0 Agent";

    // Get existing passkeys to exclude them
    const passkeysSnap = await adminDb
      .collection(`users/${uid}/passkeys`)
      .get();

    const excludeCredentials = passkeysSnap.docs.map((doc) => ({
      id: Buffer.from(doc.data().id, "base64url"),
      type: "public-key" as const,
      transports: doc.data().transports || [],
    }));

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpID,
      rpName,
      userID: uid,
      userName: decoded.email || uid,
      userDisplayName: decoded.name || decoded.email || uid,
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
        authenticatorAttachment: "platform", // Prefer platform authenticators (FaceID, TouchID, Windows Hello)
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    });

    // Store challenge in Firestore (for serverless environments)
    await adminDb.doc(`users/${uid}/webauthn_state/state`).set(
      {
        currentRegChallenge: options.challenge,
        challengeCreatedAt: new Date(),
      },
      { merge: true }
    );

    console.log(`✅ Generated registration options for user ${uid}`);

    return NextResponse.json(options, { status: 200 });
  } catch (error: any) {
    console.error("[/api/webauthn/registration/options] Error:", error);
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
