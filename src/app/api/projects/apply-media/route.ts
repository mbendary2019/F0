/**
 * Phase 100.2 (Final): Apply Media to Project with Upsert Pattern
 * Creates project if it doesn't exist, updates branding.{slot}Url
 */

import { NextRequest, NextResponse } from "next/server";
import { getFirestoreAdmin } from "@/lib/server/firebase";
import type { F0MediaAsset } from "@/types/media";

export const runtime = "nodejs";

type ApplySlot = "logo" | "splash" | "hero";

interface ApplyBody {
  projectId: string;
  mediaId: string;
  slot?: ApplySlot; // Optional - defaults to "logo"
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ApplyBody>;
    const { projectId, mediaId, slot = "logo" } = body;

    console.log('[projects/apply-media] Request:', { projectId, mediaId, slot });

    if (!projectId || !mediaId) {
      return NextResponse.json(
        { error: "Missing required parameters: projectId or mediaId" },
        { status: 400 }
      );
    }

    const db = getFirestoreAdmin();

    // 1️⃣ Get media asset
    const mediaRef = db
      .collection("projects")
      .doc(projectId)
      .collection("media_assets")
      .doc(mediaId);

    const mediaSnap = await mediaRef.get();

    if (!mediaSnap.exists) {
      console.error('[projects/apply-media] Media asset not found:', mediaId);
      return NextResponse.json(
        { error: "Media asset not found" },
        { status: 404 }
      );
    }

    const media = mediaSnap.data() as F0MediaAsset;
    console.log('[projects/apply-media] Found media asset:', { id: media.id, url: media.url });

    // 2️⃣ Prepare branding update based on slot
    const brandingUpdate: Record<string, any> = {};

    if (slot === "logo") {
      brandingUpdate["branding.logoUrl"] = media.url;
    } else if (slot === "splash") {
      brandingUpdate["branding.splashUrl"] = media.url;
    } else if (slot === "hero") {
      brandingUpdate["branding.heroUrl"] = media.url;
    }

    console.log('[projects/apply-media] Branding update:', brandingUpdate);

    // 3️⃣ Upsert project (creates if doesn't exist, updates if exists)
    const projectRef = db.collection("projects").doc(projectId);

    await projectRef.set(brandingUpdate, { merge: true });

    console.log('[projects/apply-media] Project updated/created with branding');

    // 4️⃣ Mark media asset as used
    const autoInsertTarget = slot === "logo" ? "navbar-logo" : slot;

    console.log('[projects/apply-media] Marking media as autoInserted:', { autoInsertTarget });

    await mediaRef.set(
      {
        autoInserted: true,
        autoInsertTarget,
      },
      { merge: true }
    );

    console.log('[projects/apply-media] Successfully applied media to project');

    return NextResponse.json(
      { ok: true, appliedTo: slot },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[projects/apply-media] Error:', err);
    return NextResponse.json(
      {
        error: "Internal server error in projects/apply-media",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
