import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/server/firebaseAdmin";

/**
 * API Route: Delete Passkey
 *
 * Allows users to remove a passkey from their account.
 *
 * DELETE /api/webauthn/passkey/delete
 * Body: { idToken: string, credentialId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { idToken, credentialId } = await request.json();

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

    // Delete the passkey
    await passkeyRef.delete();

    return NextResponse.json({
      success: true,
      message: "Passkey deleted successfully",
    });
  } catch (error: any) {
    console.error("Passkey delete error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
