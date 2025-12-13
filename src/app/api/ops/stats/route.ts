import { NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { db } = initAdmin();
    const { searchParams } = new URL(request.url);
    const component = searchParams.get("component");
    const window = searchParams.get("window");

    let query = db.collection("ops_stats");

    if (component) {
      query = query.where("component", "==", component) as any;
    }

    if (window) {
      query = query.where("window", "==", window) as any;
    }

    const snapshot = await query.get();
    const stats = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats", details: error.message },
      { status: 500 }
    );
  }
}
