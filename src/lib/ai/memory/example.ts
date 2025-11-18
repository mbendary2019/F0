/**
 * Example: AI Memory Clustering & Auto-Tagging
 *
 * This script demonstrates how to use the clustering and tagging functionality.
 *
 * Run:
 * OPENAI_API_KEY=sk-... npx tsx src/lib/ai/memory/example.ts
 */

import { clusterAndTag, formatClusterDisplay } from "./clusterAndTag";
import type { MemoryItem } from "./clusterMemory";

// Sample memories (mix of different topics)
const sampleMemories: MemoryItem[] = [
  // Authentication & Security
  {
    id: "1",
    userId: "user1",
    text: "Implemented Firebase authentication with Google OAuth",
    createdAt: new Date("2025-01-01"),
  },
  {
    id: "2",
    userId: "user1",
    text: "Fixed critical security bug in login flow",
    createdAt: new Date("2025-01-02"),
  },
  {
    id: "3",
    userId: "user1",
    text: "Added password reset functionality with email verification",
    createdAt: new Date("2025-01-03"),
  },
  {
    id: "4",
    userId: "user1",
    text: "Implemented MFA using TOTP authenticators",
    createdAt: new Date("2025-01-04"),
  },

  // Pricing & Subscriptions
  {
    id: "5",
    userId: "user1",
    text: "Designed new pricing tiers: Starter, Pro, Enterprise",
    createdAt: new Date("2025-01-05"),
  },
  {
    id: "6",
    userId: "user1",
    text: "Integrated Stripe checkout for subscription payments",
    createdAt: new Date("2025-01-06"),
  },
  {
    id: "7",
    userId: "user1",
    text: "Updated pricing page with feature comparison table",
    createdAt: new Date("2025-01-07"),
  },
  {
    id: "8",
    userId: "user1",
    text: "Added annual billing option with 20% discount",
    createdAt: new Date("2025-01-08"),
  },

  // UI/UX Design
  {
    id: "9",
    userId: "user1",
    text: "Redesigned homepage with modern minimalist layout",
    createdAt: new Date("2025-01-09"),
  },
  {
    id: "10",
    userId: "user1",
    text: "Improved mobile responsiveness across all pages",
    createdAt: new Date("2025-01-10"),
  },
  {
    id: "11",
    userId: "user1",
    text: "Added dark mode support with theme toggle",
    createdAt: new Date("2025-01-11"),
  },

  // API & Backend
  {
    id: "12",
    userId: "user1",
    text: "Created RESTful API endpoints for user management",
    createdAt: new Date("2025-01-12"),
  },
  {
    id: "13",
    userId: "user1",
    text: "Optimized database queries to reduce latency by 40%",
    createdAt: new Date("2025-01-13"),
  },
  {
    id: "14",
    userId: "user1",
    text: "Implemented rate limiting to prevent API abuse",
    createdAt: new Date("2025-01-14"),
  },

  // Analytics & Metrics
  {
    id: "15",
    userId: "user1",
    text: "Integrated Google Analytics 4 for user tracking",
    createdAt: new Date("2025-01-15"),
  },
  {
    id: "16",
    userId: "user1",
    text: "Built custom dashboard showing key business metrics",
    createdAt: new Date("2025-01-16"),
  },
];

async function main() {
  console.log("🚀 AI Memory Clustering & Auto-Tagging Example");
  console.log("=".repeat(60));
  console.log();

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Error: OPENAI_API_KEY environment variable not set");
    console.log();
    console.log("Run:");
    console.log("  OPENAI_API_KEY=sk-... npx tsx src/lib/ai/memory/example.ts");
    process.exit(1);
  }

  console.log(`📊 Input: ${sampleMemories.length} memories`);
  console.log();

  try {
    console.log("⏳ Step 1: Embedding memories with OpenAI...");
    console.log("⏳ Step 2: Clustering with adaptive threshold...");
    console.log("⏳ Step 3: Auto-tagging with LLM...");
    console.log();

    const startTime = Date.now();

    const results = await clusterAndTag(sampleMemories, {
      similarityThreshold: 0.83,
      minClusterSize: 2,
      maxClusterSize: 50,
      locale: "en",
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ Completed in ${duration}s`);
    console.log();
    console.log("─".repeat(60));
    console.log();

    console.log(`📦 Output: ${results.length} clusters`);
    console.log();

    // Display each cluster
    for (let i = 0; i < results.length; i++) {
      const { cluster, metadata } = results[i];

      console.log(`Cluster ${i + 1}/${results.length}`);
      console.log("─".repeat(60));
      console.log(formatClusterDisplay(results[i]));
      console.log();

      // Show first 3 items in cluster
      console.log("   Items:");
      const items = cluster.itemIds.slice(0, 3);
      for (const id of items) {
        const memory = sampleMemories.find((m) => m.id === id);
        if (memory) {
          console.log(`     - [${id}] ${memory.text.slice(0, 60)}...`);
        }
      }
      if (cluster.itemIds.length > 3) {
        console.log(`     ... and ${cluster.itemIds.length - 3} more`);
      }
      console.log();
    }

    console.log("=".repeat(60));
    console.log();

    // Summary statistics
    const avgClusterSize =
      results.reduce((sum, r) => sum + r.cluster.size, 0) / results.length;
    const avgConfidence =
      results.reduce((sum, r) => sum + r.metadata.confidence, 0) /
      results.length;
    const allTags = results.flatMap((r) => r.metadata.tags);
    const uniqueTags = new Set(allTags);

    console.log("📈 Summary Statistics:");
    console.log(`   Total memories: ${sampleMemories.length}`);
    console.log(`   Total clusters: ${results.length}`);
    console.log(`   Avg cluster size: ${avgClusterSize.toFixed(1)}`);
    console.log(`   Avg confidence: ${(avgConfidence * 100).toFixed(0)}%`);
    console.log(`   Unique tags: ${uniqueTags.size}`);
    console.log();

    console.log("🏷️  All Tags:");
    console.log(`   ${Array.from(uniqueTags).sort().join(", ")}`);
    console.log();

    console.log("✨ Example complete!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export default main;
