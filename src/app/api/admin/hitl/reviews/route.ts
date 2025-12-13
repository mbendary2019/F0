import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export const dynamic = 'force-dynamic';

async function requireReviewerOrAdmin(req: Request) {
  const hdr = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!hdr?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const idToken = hdr.slice(7);
  const dec = await getAuth().verifyIdToken(idToken);
  if (!(dec.admin || (dec as any).reviewer)) throw new Error("Forbidden");
  return dec.uid;
}

export async function GET(req: Request) {
  await requireReviewerOrAdmin(req);
  const db = getFirestore();

  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // queued|assigned|resolved
  const severity = url.searchParams.get("severity"); // low|med|high|critical
  const assignedTo = url.searchParams.get("assignedTo") || undefined;
  const since = Number(url.searchParams.get("since") || 0);
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

  let q: FirebaseFirestore.Query = db.collection("ai_reviews");
  if (status) q = q.where("status", "==", status);
  if (severity) q = q.where("severity", "==", severity);
  if (assignedTo) q = q.where("assignedTo", "==", assignedTo);
  if (since > 0) q = q.where("createdAt", ">=", since);
  q = q.orderBy("createdAt", "desc").limit(limit);

  const snap = await q.get();
  const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  return NextResponse.json({ items });
}
