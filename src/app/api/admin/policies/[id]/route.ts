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

export async function DELETE(req: Request, { params }: { params: { id: string }}) {
  await requireAdmin(req);
  const db = getFirestore();
  await db.collection("ai_policies").doc(params.id).delete();
  return NextResponse.json({ ok: true });
}
