import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  try {
    // Verify admin token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);

    if (!decoded.admin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    // Get latest analytics snapshot
    const snap = await adminDb
      .collection("analytics_daily")
      .orderBy("computedAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({
        totalOrders: 0,
        totalRevenue: 0,
        platformRevenue: 0,
        creatorRevenue: 0,
      });
    }

    const data = snap.docs[0].data();
    return NextResponse.json({
      totalOrders: data.totalOrders || 0,
      totalRevenue: data.totalRevenue || 0,
      platformRevenue: data.platformRevenue || 0,
      creatorRevenue: data.creatorRevenue || 0,
      date: data.date,
      computedAt: data.computedAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
