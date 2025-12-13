import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) throw new Error("Unauthorized");
  const dec = await verifyIdToken(h.slice(7));
  if (!dec.admin) throw new Error("Forbidden");
  return dec.uid;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const snap = await adminDb.collection("bundles").orderBy("createdAt", "desc").limit(200).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: err.message === "Unauthorized" ? 401 : 403 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const {
      id,
      slug,
      title,
      description,
      productIds = [],
      prices = {},
      discountPercent = 0,
      active = true,
      published = false,
      imageUrl = null,
    } = body || {};

    const docId = id || slug;
    if (!docId || !title) {
      return NextResponse.json({ error: "slug/title required" }, { status: 400 });
    }

    await adminDb
      .collection("bundles")
      .doc(docId)
      .set(
        {
          slug: slug || docId,
          title,
          description: description || "",
          productIds,
          prices,
          discountPercent: Number(discountPercent) || 0,
          active: !!active,
          published: !!published,
          imageUrl: imageUrl || null,
          updatedAt: Date.now(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({ ok: true, id: docId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: err.message === "Unauthorized" ? 401 : 403 }
    );
  }
}
