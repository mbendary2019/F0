import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

async function requireAdmin(req: Request) {
  const hdr = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!hdr?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const dec = await getAuth().verifyIdToken(hdr.slice(7));
  if (!dec.admin) throw new Error("Forbidden");
  return dec.uid;
}

export async function GET(req: Request) {
  await requireAdmin(req);
  const db = getFirestore();
  const snap = await db.collection("products").orderBy("createdAt","desc").limit(500).get();
  return NextResponse.json({ items: snap.docs.map(d=>({ id:d.id, ...(d.data() as any) })) });
}

export async function POST(req: Request) {
  const uid = await requireAdmin(req);
  const body = await req.json();
  const { id, ...data } = body || {};
  const db = getFirestore();

  const payload = {
    ...data,
    priceUsd: Number(data.priceUsd || 0),
    creatorSharePct: Number(data.creatorSharePct ?? 0.85),
    updatedBy: uid,
    updatedAt: Date.now(),
    createdAt: data.createdAt || Date.now()
  };

  if (id) {
    await db.collection("products").doc(id).set(payload, { merge: true });
    return NextResponse.json({ ok: true, id });
  } else {
    const ref = await db.collection("products").add(payload);
    return NextResponse.json({ ok: true, id: ref.id });
  }
}
