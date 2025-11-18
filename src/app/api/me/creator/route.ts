import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

async function requireUser(req: Request) {
  const hdr = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!hdr?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const dec = await getAuth().verifyIdToken(hdr.slice(7));
  return dec.uid;
}

export async function GET(req: Request) {
  const uid = await requireUser(req);
  const db = getFirestore();
  const snap = await db.collection("creators").doc(uid).get();
  return NextResponse.json(snap.exists ? snap.data() : {});
}
