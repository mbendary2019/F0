import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export const runtime = "nodejs";

/**
 * POST /api/backup-codes/generate
 * Generates and stores backup recovery codes
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authorization" },
        { status: 401 }
      );
    }

    const idToken = authHeader.split("Bearer ")[1];
    const { codes } = await req.json();

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json(
        { error: "Invalid codes" },
        { status: 400 }
      );
    }

    // Call Firebase Function to store codes securely
    const functionUrl = process.env.FIREBASE_FUNCTION_URL ||
      `https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net`;

    const response = await fetch(`${functionUrl}/generateBackupCodes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ codes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate backup codes");
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[/api/backup-codes/generate] Error:", error);
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
