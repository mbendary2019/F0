import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

async function requireAdmin(req: Request) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const dec = await getAuth().verifyIdToken(h.slice(7));
  if (!(dec as any).admin) {
    throw new Error("Forbidden");
  }
  return dec.uid;
}

/**
 * Get list of platform monthly reports
 */
export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const db = getFirestore();

    const snap = await db
      .collection("platform_reports")
      .doc("files")
      .collection("months")
      .orderBy("month", "desc")
      .limit(24)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return NextResponse.json({ items });
  } catch (err: any) {
    const status = err.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: err.message }, { status });
  }
}
