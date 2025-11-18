import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  await initAdmin();
  try {
    const idToken = req.headers.get("authorization")?.replace("Bearer ","") ||
                    req.cookies.get("__session")?.value;
    if (!idToken) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const decoded = await getAuth().verifyIdToken(idToken);
    if (!decoded) return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 401 });

    const date = req.nextUrl.searchParams.get("date"); // اختياري: yyyy-mm-dd
    const db = getFirestore();

    if (date) {
      const doc = await db.collection("ops_reports").doc(date).get();
      if (!doc.exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      return NextResponse.json({ date, insights: (doc.data() as any)?.insights ?? null });
    }

    const snap = await db.collection("ops_reports").orderBy("date","desc").limit(1).get();
    if (snap.empty) return NextResponse.json({ items: [] });
    const d = snap.docs[0].data() as any;
    return NextResponse.json({ date: d.date, insights: d.insights ?? null });
  } catch (e:any) {
    return NextResponse.json({ error: "INTERNAL", detail: e?.message }, { status: 500 });
  }
}
