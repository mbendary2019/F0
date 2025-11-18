/**
 * scripts/seedMemorySnippets-admin.ts
 * يضيف بيانات تجريبية إلى Firestore Emulator باستخدام Admin SDK (يتجاوز security rules)
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm tsx scripts/seedMemorySnippets-admin.ts
 */

import * as admin from "firebase-admin";

// Initialize Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "demo-project",
  });
}

const db = admin.firestore();

// Connect to emulator if specified
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log(`✅ Using Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
}

async function seedMemorySnippets() {
  const workspaceId = "demo";
  const roomId = "ide-file-demo-page-tsx";
  const sessionId = "ide-file-demo-page-tsx__20251106";
  const expire_at = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // بعد 90 يوم
  );

  const examples = [
    {
      type: "auto-summary",
      content: "Deploy guide: run firebase deploy --only hosting",
      pinned: false,
      stats: { messages: 15, participants: 2 },
      participants: [
        { uid: "user1", name: "Developer 1" },
        { uid: "user2", name: "Developer 2" },
      ],
      writer: "cf" as const,
    },
    {
      type: "auto-summary",
      content: "Added semantic search to memory timeline with hybrid retrieval",
      pinned: true,
      stats: { messages: 24, participants: 3 },
      participants: [
        { uid: "user1", name: "Developer 1" },
        { uid: "user2", name: "Developer 2" },
        { uid: "user3", name: "Developer 3" },
      ],
      writer: "cf" as const,
    },
    {
      type: "manual-pin",
      content: "Phase 59 completed: Cognitive Mesh Graph live with job management",
      pinned: true,
      stats: { messages: 8, participants: 1 },
      participants: [{ uid: "user1", name: "Developer 1" }],
      writer: "user" as const,
    },
    {
      type: "auto-summary",
      content: "Fix: Added toList() helper and null protection for useMemoryTimeline hook",
      pinned: false,
      stats: { messages: 12, participants: 2 },
      participants: [
        { uid: "user1", name: "Developer 1" },
        { uid: "user2", name: "Developer 2" },
      ],
      writer: "cf" as const,
    },
    {
      type: "system-note",
      content: "Benchmark results: 420ms P95 latency ✅ Memory retrieval optimized",
      pinned: false,
      stats: { messages: 5, participants: 1 },
      participants: [{ uid: "system", name: "System" }],
      writer: "cf" as const,
    },
    {
      type: "auto-summary",
      content: "Implemented job cancellation with TTL cleanup (24h default)",
      pinned: false,
      stats: { messages: 18, participants: 2 },
      participants: [
        { uid: "user1", name: "Developer 1" },
        { uid: "user3", name: "Developer 3" },
      ],
      writer: "cf" as const,
    },
    {
      type: "manual-pin",
      content: "Important: All API endpoints now have workspace isolation via Firestore rules",
      pinned: true,
      stats: { messages: 6, participants: 1 },
      participants: [{ uid: "user1", name: "Developer 1" }],
      writer: "user" as const,
    },
    {
      type: "auto-summary",
      content: "Enhanced OpsMemoryExtras with Job Log and Edge Explorer components",
      pinned: false,
      stats: { messages: 22, participants: 3 },
      participants: [
        { uid: "user1", name: "Developer 1" },
        { uid: "user2", name: "Developer 2" },
        { uid: "user3", name: "Developer 3" },
      ],
      writer: "cf" as const,
    },
  ];

  console.log("🌱 Seeding memory snippets to ops_collab_memory...\n");

  const batch = db.batch();
  const docs: string[] = [];

  for (const item of examples) {
    const ref = db.collection("ops_collab_memory").doc();
    batch.set(ref, {
      workspaceId,
      roomId,
      sessionId,
      type: item.type,
      content: item.content,
      pinned: item.pinned,
      stats: item.stats,
      participants: item.participants,
      writer: item.writer,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expire_at,
    });
    docs.push(ref.id);
    console.log(`✅ [${item.type.padEnd(13)}] ${ref.id.slice(0, 8)}... - ${item.content.slice(0, 50)}...`);
  }

  await batch.commit();

  console.log("\n🎉 Done seeding! You can now open:");
  console.log("👉 http://localhost:3030/en/ops/memory?room=ide-file-demo-page-tsx&session=ide-file-demo-page-tsx__20251106");
  console.log("\n📊 Stats:");
  console.log(`   - Total items: ${examples.length}`);
  console.log(`   - Auto-summaries: ${examples.filter(x => x.type === 'auto-summary').length}`);
  console.log(`   - Manual pins: ${examples.filter(x => x.type === 'manual-pin').length}`);
  console.log(`   - System notes: ${examples.filter(x => x.type === 'system-note').length}`);
  console.log(`   - Pinned items: ${examples.filter(x => x.pinned).length}`);
}

seedMemorySnippets()
  .then(() => {
    console.log("\n✅ All done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Error seeding:", err);
    process.exit(1);
  });
