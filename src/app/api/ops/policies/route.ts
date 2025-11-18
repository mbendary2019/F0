import { NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { db } = initAdmin();
    const { searchParams } = new URL(request.url);
    const policyId = searchParams.get("id");
    const status = searchParams.get("status");

    let query = db.collection("ops_policies").orderBy("createdAt", "desc");

    if (policyId) {
      query = query.where("id", "==", policyId) as any;
    }

    if (status) {
      query = query.where("status", "==", status) as any;
    }

    const snapshot = await query.get();
    const policies = snapshot.docs.map((doc) => ({
      docId: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json(policies);
  } catch (error: any) {
    console.error("Error fetching policies:", error);
    return NextResponse.json(
      { error: "Failed to fetch policies", details: error.message },
      { status: 500 }
    );
  }
}
