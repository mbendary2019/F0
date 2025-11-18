import { NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { db } = initAdmin();
    const { searchParams } = new URL(request.url);
    const component = searchParams.get("component");
    const window = searchParams.get("window");

    let query = db.collection("ops_confidence");

    if (component) {
      query = query.where("component", "==", component) as any;
    }

    if (window) {
      query = query.where("window", "==", window) as any;
    }

    const snapshot = await query.get();
    const confidence = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(confidence);
  } catch (error: any) {
    console.error("Error fetching confidence:", error);
    return NextResponse.json(
      { error: "Failed to fetch confidence data", details: error.message },
      { status: 500 }
    );
  }
}
