import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

async function requireUser(req: Request) {
  const hdr = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!hdr?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const idToken = hdr.slice(7);
  const dec = await getAuth().verifyIdToken(idToken);
  return dec.uid;
}

export async function GET(req: Request) {
  const uid = await requireUser(req);
  const db = getFirestore();
  const snap = await db.collection("licenses").where("uid","==",uid).orderBy("grantedAt","desc").limit(100).get();

  const items = await Promise.all(snap.docs.map(async d => {
    const lic = d.data() as any;
    const p = await db.collection("products").doc(lic.productId).get();
    return { id: d.id, ...lic, product: p.exists ? p.data() : null };
  }));

  return NextResponse.json({ items });
}
