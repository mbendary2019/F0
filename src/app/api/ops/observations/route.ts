import { NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { db } = initAdmin();
    const { searchParams } = new URL(request.url);
    const component = searchParams.get("component");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const since = searchParams.get("since");

    let query = db.collection("ops_observations").orderBy("ts", "desc").limit(limit);

    if (component) {
      query = query.where("component", "==", component) as any;
    }

    if (since) {
      const sinceMs = parseInt(since, 10);
      query = query.where("ts", ">", sinceMs) as any;
    }

    const snapshot = await query.get();
    const observations = snapshot.docs.map((doc) => doc.data());

    return NextResponse.json(observations);
  } catch (error: any) {
    console.error("Error fetching observations:", error);
    return NextResponse.json(
      { error: "Failed to fetch observations", details: error.message },
      { status: 500 }
    );
  }
}
