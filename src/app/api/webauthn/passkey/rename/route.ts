import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/server/firebaseAdmin";

/**
 * API Route: Rename Passkey
 *
 * Allows users to set a custom name for their passkeys
 * for easier identification and management.
 *
 * POST /api/webauthn/passkey/rename
 * Body: { idToken: string, credentialId: string, name: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken, credentialId, name } = await request.json();

    // Validate inputs
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid idToken" },
        { status: 400 }
      );
    }

    if (!credentialId || typeof credentialId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid credentialId" },
        { status: 400 }
      );
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid name" },
        { status: 400 }
      );
    }

    // Limit name length
    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: "Name must be 50 characters or less" },
        { status: 400 }
      );
    }

    // Verify Firebase ID token
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const uid = decoded.uid;

    // Check if passkey exists and belongs to user
    const passkeyRef = adminDb.doc(`users/${uid}/passkeys/${credentialId}`);
    const passkeyDoc = await passkeyRef.get();

    if (!passkeyDoc.exists) {
      return NextResponse.json(
        { error: "Passkey not found" },
        { status: 404 }
      );
    }

    // Update passkey name
    await passkeyRef.update({
      name: trimmedName,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Passkey renamed successfully",
    });
  } catch (error: any) {
    console.error("Passkey rename error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
