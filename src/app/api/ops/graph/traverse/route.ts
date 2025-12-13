import { NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { db } = initAdmin();
    const { from, maxDepth = 2, edgeKinds } = await request.json();

    if (!from) {
      return NextResponse.json(
        { error: "Missing 'from' parameter" },
        { status: 400 }
      );
    }

    // Fetch all edges (with optional kind filter)
    let edgesQuery = db.collection("ops_graph_edges");
    if (edgeKinds && Array.isArray(edgeKinds) && edgeKinds.length > 0) {
      edgesQuery = edgesQuery.where("kind", "in", edgeKinds) as any;
    }

    const edgesSnapshot = await edgesQuery.get();
    const allEdges = edgesSnapshot.docs.map((doc) => doc.data() as any);

    // BFS traversal
    const visited = new Set<string>([from]);
    const queue: Array<{ id: string; depth: number }> = [{ id: from, depth: 0 }];
    const subEdges: any[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      const { id, depth } = current;

      if (depth >= maxDepth) continue;

      for (const edge of allEdges) {
        if (edge.src === id && !visited.has(edge.dst)) {
          visited.add(edge.dst);
          subEdges.push(edge);
          queue.push({ id: edge.dst, depth: depth + 1 });
        }
      }
    }

    // Fetch node details for visited nodes
    const nodeIds = Array.from(visited);
    const nodes: any[] = [];

    // Batch fetch nodes
    for (const nodeId of nodeIds) {
      const nodeDoc = await db.collection("ops_graph_nodes").doc(nodeId).get();
      if (nodeDoc.exists) {
        nodes.push(nodeDoc.data());
      }
    }

    return NextResponse.json({
      nodes,
      edges: subEdges,
      visited: nodeIds,
    });
  } catch (error: any) {
    console.error("Error traversing graph:", error);
    return NextResponse.json(
      { error: "Failed to traverse graph", details: error.message },
      { status: 500 }
    );
  }
}
