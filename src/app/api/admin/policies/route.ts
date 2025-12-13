import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export const dynamic = 'force-dynamic';

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
  const snap = await db.collection("ai_policies").orderBy("priority","asc").get();
  return NextResponse.json({ items: snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) });
}

export async function POST(req: Request) {
  const uid = await requireAdmin(req);
  const body = await req.json();
  const { id, name, enabled=true, priority=100, conditions={}, actions={} } = body || {};
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (typeof priority !== "number") return NextResponse.json({ error: "priority must be number" }, { status: 400 });

  const db = getFirestore();
  const payload = { name, enabled, priority, conditions, actions, updatedBy: uid, updatedAt: Date.now() };
  if (id) {
    await db.collection("ai_policies").doc(id).set(payload, { merge: true });
    return NextResponse.json({ ok: true, id });
  } else {
    const ref = await db.collection("ai_policies").add({ ...payload, createdBy: uid, createdAt: Date.now() });
    return NextResponse.json({ ok: true, id: ref.id });
  }
}
