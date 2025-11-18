import { NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { db } = initAdmin();
    const { searchParams } = new URL(request.url);
    const component = searchParams.get("component");
    const limit = parseInt(searchParams.get("limit") || "200", 10);

    let query = db.collection("ops_decisions")
      .orderBy("ts", "desc")
      .limit(limit);

    if (component) {
      query = query.where("component", "==", component) as any;
    }

    const snapshot = await query.get();
    const decisions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(decisions);
  } catch (error: any) {
    console.error("Error fetching decisions:", error);
    return NextResponse.json(
      { error: "Failed to fetch decisions data", details: error.message },
      { status: 500 }
    );
  }
}
