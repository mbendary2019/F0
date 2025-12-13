import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await verifyIdToken(token);
    const body = await req.json();
    const { taxId, taxIdType } = body;

    if (!taxId || !taxIdType) {
      return NextResponse.json({ error: "taxId and taxIdType required" }, { status: 400 });
    }

    // Update the user's tax ID in Firestore
    await adminDb.collection('users').doc(decoded.uid).update({
      taxId,
      taxIdType,
      updatedAt: Date.now()
    });

    return NextResponse.json({ success: true, taxId, taxIdType });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
