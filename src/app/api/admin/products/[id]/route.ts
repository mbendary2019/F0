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

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await requireAdmin(req);
  const db = getFirestore();
  await db.collection("products").doc(params.id).delete();
  return NextResponse.json({ ok: true });
}
