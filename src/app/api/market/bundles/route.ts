import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const q = await adminDb
      .collection("bundles")
      .where("active", "==", true)
      .where("published", "==", true)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const items = q.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
