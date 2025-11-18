/**
 * Phase 63 Day 3: Reports API
 * Returns list of recent daily reports with signed download URLs
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";

export async function GET(req: NextRequest) {
  try {
    // Authentication: Get token from Authorization header or __session cookie
    const authHeader = req.headers.get("authorization");
    const idToken = authHeader?.replace("Bearer ", "") || req.cookies.get("__session")?.value;

    if (!idToken) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify token
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (error: any) {
      console.error("[reports-api] Token verification failed:", error.message);
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: "Invalid authentication token" },
        { status: 401 }
      );
    }

    if (!decoded) {
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: "Token verification failed" },
        { status: 401 }
      );
    }

    // Fetch recent reports from Firestore
    const snap = await adminDb
      .collection("ops_reports")
      .orderBy("date", "desc")
      .limit(14) // Last 14 days
      .get();

    // Generate signed URLs for each report
    const bucket = getStorage().bucket();
    const rows: any[] = [];

    for (const doc of snap.docs) {
      const data = doc.data() as any;
      const pdfPath = data.files?.pdf?.path;
      const xlsxPath = data.files?.xlsx?.path;

      // Generate signed URLs valid for 15 minutes
      const expires = Date.now() + 15 * 60 * 1000;

      const [pdfUrl] = pdfPath
        ? await bucket.file(pdfPath).getSignedUrl({
            action: "read",
            expires,
          })
        : [null];

      const [xlsxUrl] = xlsxPath
        ? await bucket.file(xlsxPath).getSignedUrl({
            action: "read",
            expires,
          })
        : [null];

      rows.push({
        date: data.date,
        createdAt: data.createdAt,
        pdf: {
          ...data.files?.pdf,
          url: pdfUrl,
        },
        xlsx: {
          ...data.files?.xlsx,
          url: xlsxUrl,
        },
      });
    }

    const response = NextResponse.json({ items: rows });

    // Cache for 1 minute (balance between freshness and performance)
    response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");

    return response;
  } catch (error: any) {
    console.error("[reports-api] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to fetch reports",
        detail: error?.message,
      },
      { status: 500 }
    );
  }
}
