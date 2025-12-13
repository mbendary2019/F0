import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { adminDb } from "@/server/firebaseAdmin";
import { randomUUID } from "crypto";

export const dynamic = 'force-dynamic';

export const runtime = "nodejs";

/**
 * POST /api/webauthn/authentication/options
 * Generate authentication options for WebAuthn passkey sign-in
 */
export async function POST(req: NextRequest) {
  try {
    const rpID = process.env.NEXT_PUBLIC_RP_ID!;

    // Generate authentication options
    // We use empty allowCredentials to enable discoverable credentials
    // (passkeys that can be found by the authenticator)
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      // allowCredentials: [] // Empty to allow discoverable credentials
    });

    // Store challenge in a temporary collection with UUID
    // This allows sign-in without knowing the user beforehand
    const challengeId = randomUUID();
    await adminDb.doc(`webauthn_challenges/${challengeId}`).set({
      challenge: options.challenge,
      type: "auth",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    console.log(`✅ Generated authentication options with challenge ID: ${challengeId}`);

    return NextResponse.json(
      {
        ...options,
        challengeId,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[/api/webauthn/authentication/options] Error:", error);
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
