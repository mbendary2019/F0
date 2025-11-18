import type { ContextHandle } from "@/lib/types/context";
import { adminDb } from "@/lib/firebaseAdmin";

export type RawDoc = {
  id: string;
  text: string;
  embedding?: number[];
  meta?: Record<string, unknown>;
  source?: string;
  snippet?: string;
  url?: string;
  score?: number;
};

/**
 * Fetch documents from memory clusters
 */
async function fetchFromClusters(userId: string, clusterIds: string[] = []): Promise<RawDoc[]> {
  if (!clusterIds.length) return [];

  const docs: RawDoc[] = [];
  for (const cid of clusterIds) {
    try {
      const doc = await adminDb.collection("ops_memory_clusters").doc(cid).get();
      if (doc.exists) {
        const data = doc.data();
        docs.push({
          id: `cluster:${cid}`,
          text: data?.summary || data?.content || "",
          source: "cluster",
          snippet: (data?.summary || "").slice(0, 200),
          meta: { clusterId: cid, ...data },
        });
      }
    } catch (err) {
      console.error(`[retriever] error fetching cluster ${cid}:`, err);
    }
  }

  return docs;
}

/**
 * Fetch linked artifacts for user
 */
async function fetchLinkedArtifacts(userId: string): Promise<RawDoc[]> {
  try {
    const snap = await adminDb
      .collection("ops_memory_links")
      .where("userId", "==", userId)
      .limit(20)
      .get();

    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        text: data?.content || data?.title || "",
        source: data?.source || "link",
        url: data?.url,
        snippet: (data?.content || "").slice(0, 200),
        meta: data,
      };
    });
  } catch (err) {
    console.error("[retriever] error fetching linked artifacts:", err);
    return [];
  }
}

/**
 * Fetch recent memory snippets
 */
async function fetchMemorySnippets(userId: string, query: string): Promise<RawDoc[]> {
  try {
    const snap = await adminDb
      .collection("ops_memory_snippets")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    return snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data?.text || "",
          source: "snippet",
          snippet: (data?.text || "").slice(0, 200),
          meta: {
            roomId: data?.roomId,
            sessionId: data?.sessionId,
            createdAt: data?.createdAt,
          },
        };
      })
      .filter((doc) => doc.text.length > 0);
  } catch (err) {
    console.error("[retriever] error fetching memory snippets:", err);
    return [];
  }
}

/**
 * Main retrieval function with Firestore integration
 */
export async function retrieve(query: string, ctx: ContextHandle): Promise<RawDoc[]> {
  console.log(`[retriever] query="${query}" for user=${ctx.userId}`);

  const docs: RawDoc[] = [];

  // 1) Fetch from clusters if specified
  if (ctx.clusterIds && ctx.clusterIds.length > 0) {
    const clusterDocs = await fetchFromClusters(ctx.userId, ctx.clusterIds);
    docs.push(...clusterDocs);
  }

  // 2) Fetch linked artifacts (recent knowledge)
  const linkedDocs = await fetchLinkedArtifacts(ctx.userId);
  docs.push(...linkedDocs);

  // 3) Fetch memory snippets
  const snippetDocs = await fetchMemorySnippets(ctx.userId, query);
  docs.push(...snippetDocs);

  // 4) Fallback if no documents found
  if (docs.length === 0) {
    docs.push({
      id: "fallback:1",
      text: `No indexed documents found. Query: ${query}`,
      source: "fallback",
      snippet: `Query: ${query}`,
      meta: { fallback: true },
    });
  }

  console.log(`[retriever] found ${docs.length} documents`);
  return docs;
}
