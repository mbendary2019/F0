import { NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { db } = initAdmin();
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const src = searchParams.get("src");
    const limit = parseInt(searchParams.get("limit") || "5000", 10);

    let query = db.collection("ops_graph_edges").limit(limit);

    if (kind) {
      query = query.where("kind", "==", kind) as any;
    }

    if (src) {
      query = query.where("src", "==", src) as any;
    }

    const snapshot = await query.get();
    const edges = snapshot.docs.map((doc) => doc.data());

    return NextResponse.json(edges);
  } catch (error: any) {
    console.error("Error fetching graph edges:", error);
    return NextResponse.json(
      { error: "Failed to fetch graph edges", details: error.message },
      { status: 500 }
    );
  }
}
