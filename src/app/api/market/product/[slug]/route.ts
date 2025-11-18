import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";

export async function GET(_req: Request, { params }: { params: { slug: string }}) {
  const db = getFirestore();
  const snap = await db.collection("products").where("slug","==",params.slug).limit(1).get();
  if (snap.empty) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = snap.docs[0];
  return NextResponse.json({ id: doc.id, ...(doc.data() as any) });
}
