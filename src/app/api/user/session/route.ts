// src/app/api/user/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, verifySessionCookie, adminDb } from "@/lib/firebaseAdmin";

/**
 * GET /api/user/session
 *
 * Returns the current user's session information including:
 * - User ID (uid)
 * - Authentication status
 * - Custom claims (roles, permissions)
 * - Firestore user document data
 */
export async function GET(request: NextRequest) {
  try {
    // Extract session cookie or authorization header
    const sessionCookie = request.cookies.get("session")?.value;
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    // No authentication provided
    if (!sessionCookie && !token) {
      return NextResponse.json(
        {
          authenticated: false,
          error: "No authentication provided"
        },
        { status: 401 }
      );
    }

    // Verify the session cookie or token
    let decodedToken: any;
    try {
      if (sessionCookie) {
        decodedToken = await verifySessionCookie(sessionCookie);
      } else if (token) {
        decodedToken = await verifyIdToken(token);
      }
    } catch (verifyError: any) {
      console.error("Token verification error:", verifyError?.message || verifyError);
      return NextResponse.json(
        {
          authenticated: false,
          error: "Invalid or expired token",
          details: verifyError?.message || "Verification failed"
        },
        { status: 401 }
      );
    }

    if (!decodedToken || !decodedToken.uid) {
      return NextResponse.json(
        {
          authenticated: false,
          error: "Token verification failed"
        },
        { status: 401 }
      );
    }

    // Get user document from Firestore (if exists)
    let userData = null;
    try {
      const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists) {
        userData = userDoc.data();
      }
    } catch (firestoreError: any) {
      console.warn("Error fetching user document:", firestoreError?.message);
      // Don't fail the request if Firestore is unavailable
    }

    // Build session response
    const session = {
      authenticated: true,
      user: {
        uid: decodedToken.uid,
        email: userData?.email || null,
        displayName: userData?.displayName || null,
        photoURL: userData?.photoURL || null,
        customClaims: decodedToken.claims || decodedToken || {},
      },
      firestore: userData || null,
    };

    return NextResponse.json(session, { status: 200 });
  } catch (error: any) {
    console.error("Error in /api/user/session:", error);
    return NextResponse.json(
      {
        authenticated: false,
        error: "Internal server error",
        details: error?.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}
