import { NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { db } = initAdmin();
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const limit = parseInt(searchParams.get("limit") || "2000", 10);

    let query = db.collection("ops_graph_nodes").limit(limit);

    if (kind) {
      query = query.where("kind", "==", kind) as any;
    }

    const snapshot = await query.get();
    const nodes = snapshot.docs.map((doc) => doc.data());

    return NextResponse.json(nodes);
  } catch (error: any) {
    console.error("Error fetching graph nodes:", error);
    return NextResponse.json(
      { error: "Failed to fetch graph nodes", details: error.message },
      { status: 500 }
    );
  }
}
