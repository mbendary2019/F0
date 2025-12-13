import { NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { db } = initAdmin();
    const body = await request.json();
    const { id, version } = body;

    if (!id || !version) {
      return NextResponse.json(
        { error: "Missing required fields: id, version" },
        { status: 400 }
      );
    }

    // Check if policy exists
    const policyRef = db.collection("ops_policies").doc(`${id}@${version}`);
    const policyDoc = await policyRef.get();

    if (!policyDoc.exists) {
      return NextResponse.json(
        { error: `Policy ${id}@${version} not found` },
        { status: 404 }
      );
    }

    const policy = policyDoc.data();

    if (policy?.status === "active") {
      return NextResponse.json({
        success: true,
        message: "Policy already active",
      });
    }

    // Archive current active versions
    const activeSnap = await db
      .collection("ops_policies")
      .where("id", "==", id)
      .where("status", "==", "active")
      .get();

    const batch = db.batch();

    activeSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "archived" });
    });

    // Activate new version
    batch.update(policyRef, { status: "active" });

    // Create audit log
    const auditRef = db.collection("ops_audit").doc();
    batch.set(auditRef, {
      ts: Date.now(),
      actor: "admin-ui",
      action: "activate",
      id,
      to: version,
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Policy ${id}@${version} activated`,
    });
  } catch (error: any) {
    console.error("Error activating policy:", error);
    return NextResponse.json(
      { error: "Failed to activate policy", details: error.message },
      { status: 500 }
    );
  }
}
