import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  const db = getFirestore();
  const snap = await db.collection("products").where("active","==",true).orderBy("createdAt","desc").limit(100).get();
  const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  return NextResponse.json({ items });
}
