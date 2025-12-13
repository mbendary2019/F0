import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = 'force-dynamic';

async function requireUser(req: Request) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const dec = await getAuth().verifyIdToken(h.slice(7));
  return dec.uid;
}

/**
 * Get list of creator statements
 */
export async function GET(req: Request) {
  try {
    const uid = await requireUser(req);
    const db = getFirestore();

    const snap = await db
      .collection("creator_statements")
      .doc(uid)
      .collection("files")
      .orderBy("month", "desc")
      .limit(24)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
