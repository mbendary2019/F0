import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp(); // يلتقط Emulator عبر FIRESTORE_EMULATOR_HOST تلقائيًا
}
const db = admin.firestore();

async function main() {
  const workspaceId = "demo";
  const roomId = "ide-file-demo-page-tsx";
  const sessionId = "room__20251106";
  const expireAt = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  );

  const items = [
    "Deploy guide: run firebase deploy --only hosting",
    "Added semantic search to memory timeline",
    "Phase 59 completed: Cognitive Mesh Graph live",
    "Fix: null protection for useMemoryTimeline hook",
    "Benchmark results: 420ms P95 latency",
  ];

  console.log("🌱 Seeding into ops_memory_snippets ...");
  for (const text of items) {
    await db.collection("ops_memory_snippets").add({
      workspaceId,
      roomId,
      sessionId,
      text,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expire_at: expireAt,
    });
    console.log("✅ added:", text);
  }

  console.log(
    "Open: http://localhost:3030/en/ops/memory?room=ide-file-demo-page-tsx&session=room__20251106"
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
