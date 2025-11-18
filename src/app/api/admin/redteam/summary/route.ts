import { NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

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

  const testsSnap = await db.collection("redteam_tests").where("active","==",true).get();
  const runsSnap  = await db.collection("redteam_runs").orderBy("finishedAt","desc").limit(10).get();

  const runs = runsSnap.docs.map(d => ({ id:d.id, ...(d.data() as any) }));
  const last = runs[0] || null;

  return NextResponse.json({
    testsCount: testsSnap.size,
    lastRun: last ? { id:last.id, passRate: last.passRate, total: last.total, finishedAt: last.finishedAt } : null,
    recent: runs.map(r => ({ id:r.id, passRate:r.passRate, total:r.total, finishedAt:r.finishedAt }))
  });
}
