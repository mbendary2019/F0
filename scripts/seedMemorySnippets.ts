/**
 * scripts/seedMemorySnippets.ts
 * يضيف بيانات تجريبية إلى Firestore لاختبار Memory Timeline
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

// 🧩 استخدم نفس إعدادات مشروعك (من .env أو firebase.ts)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedMemorySnippets() {
  const workspaceId = "demo";
  const roomId = "ide-file-demo-page-tsx";
  const sessionId = "ide-file-demo-page-tsx__20251106";
  const expire_at = Timestamp.fromDate(
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
      content: "Phase 59 completed: Cognitive Mesh Graph live",
      pinned: true,
      stats: { messages: 8, participants: 1 },
      participants: [{ uid: "user1", name: "Developer 1" }],
      writer: "user" as const,
    },
    {
      type: "auto-summary",
      content: "Fix: null protection for useMemoryTimeline hook",
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
      content: "Benchmark results: 420ms P95 latency ✅",
      pinned: false,
      stats: { messages: 5, participants: 1 },
      participants: [{ uid: "system", name: "System" }],
      writer: "cf" as const,
    },
  ];

  console.log("🌱 Seeding memory snippets to ops_collab_memory...");
  for (const item of examples) {
    await addDoc(collection(db, "ops_collab_memory"), {
      workspaceId,
      roomId,
      sessionId,
      type: item.type,
      content: item.content,
      pinned: item.pinned,
      stats: item.stats,
      participants: item.participants,
      writer: item.writer,
      createdAt: serverTimestamp(),
      expire_at,
    });
    console.log(`✅ Added [${item.type}]: ${item.content}`);
  }

  console.log("\n🎉 Done seeding! You can now open:");
  console.log("👉 http://localhost:3030/en/ops/memory?room=ide-file-demo-page-tsx&session=ide-file-demo-page-tsx__20251106");
}

seedMemorySnippets()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error seeding:", err);
    process.exit(1);
  });
