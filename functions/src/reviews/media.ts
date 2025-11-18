import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

/**
 * Trigger when review status changes
 * Copies images from private to public storage when approved
 */
export const onReviewStatusChange = onDocumentWritten(
  "product_reviews/{reviewId}",
  async (event) => {
    const before = event.data?.before.exists ? (event.data.before.data() as any) : null;
    const after = event.data?.after.exists ? (event.data.after.data() as any) : null;
    if (!after) return;

    const becameApproved = after.status === "approved" && before?.status !== "approved";
    if (!becameApproved) return;

    const uid = after.uid as string;
    const reviewId = event.params.reviewId as string;
    const bucket = admin.storage().bucket();

    // Copy any images from private path to public path
    const [files] = await bucket.getFiles({ prefix: `review_media/${uid}/${reviewId}/` });
    if (!files.length) {
      await event.data!.after.ref.set({ mediaUrls: [] }, { merge: true });
      return;
    }

    const publicUrls: string[] = [];
    for (const f of files) {
      const name = f.name.split("/").pop()!;
      const dest = bucket.file(`review_media_public/${reviewId}/${name}`);
      await f.copy(dest);
      // Generate public URL (our rules allow read: true)
      const encoded = encodeURIComponent(dest.name);
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media`;
      publicUrls.push(url);
    }

    await event.data!.after.ref.set({ mediaUrls: publicUrls }, { merge: true });
  }
);
