import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

async function requireAdmin(req: Request) {
  const hdr = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!hdr?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const idToken = hdr.slice(7);
  const dec = await getAuth().verifyIdToken(idToken);
  if (!dec.admin) throw new Error("Forbidden");
  return dec.uid;
}

export async function GET(req: Request) {
  await requireAdmin(req);
  const db = getFirestore();
  const q = new URL(req.url).searchParams;
  const active = q.get("active");
  let ref: FirebaseFirestore.Query = db.collection("redteam_tests");
  if (active === "true") ref = ref.where("active","==",true);
  const snap = await ref.orderBy("category","asc").limit(500).get();
  return NextResponse.json({ items: snap.docs.map(d=>({ id:d.id, ...(d.data() as any) })) });
}

export async function POST(req: Request) {
  const uid = await requireAdmin(req);
  const body = await req.json();
  const { id, prompt, expected, category="general", severity="low", active=true } = body || {};
  if (!prompt) return NextResponse.json({ error:"prompt required" }, { status: 400 });

  const db = getFirestore();
  if (id) {
    await db.collection("redteam_tests").doc(id).set({ prompt, expected, category, severity, active, updatedBy: uid, updatedAt: Date.now() }, { merge: true });
    return NextResponse.json({ ok:true, id });
  } else {
    const ref = await db.collection("redteam_tests").add({ prompt, expected, category, severity, active, createdBy: uid, createdAt: Date.now() });
    return NextResponse.json({ ok:true, id: ref.id });
  }
}
