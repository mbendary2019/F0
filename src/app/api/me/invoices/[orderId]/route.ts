import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyIdToken } from "@/lib/firebaseAdmin";
import { getStorage } from "firebase-admin/storage";

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const h = req.headers.get("authorization") || "";
    if (!h.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dec = await verifyIdToken(h.slice(7));
    const uid = dec.uid;

    const o = await adminDb.collection("orders").doc(params.orderId).get();
    if (!o.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const od = o.data() as any;
    if (od.uid !== uid && !dec.admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if invoice already exists
    const inv = await adminDb.collection("invoices").doc(params.orderId).get();
    if (!inv.exists) {
      return NextResponse.json({ needsGeneration: true });
    }

    // Get signed URL
    const bucket = getStorage().bucket();
    const [url] = await bucket.file(`invoices/${params.orderId}.pdf`).getSignedUrl({
      action: "read",
      expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
