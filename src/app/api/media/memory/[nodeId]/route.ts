// src/app/api/media/memory/[nodeId]/route.ts
// =============================================================================
// Phase 165.5 – Media Memory Single Node API
// GET: Get node with optional graph/similar
// PATCH: Update node
// DELETE: Delete node
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '@/lib/server/firebase';

// Initialize Firebase
initFirebaseAdmin();
const db = getFirestore();

// =============================================================================
// Types
// =============================================================================

type MediaMemoryKind = 'image' | 'pdf' | 'audio';
type MediaMemoryEdgeType =
  | 'style_similar'
  | 'layout_similar'
  | 'entity_overlap'
  | 'same_project'
  | 'same_conversation'
  | 'derived_from'
  | 'user_linked';

interface MediaMemoryTag {
  key: string;
  value: string;
  source: 'auto' | 'user' | 'agent';
  confidence?: number;
}

interface MediaMemoryStyleHints {
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  shadowLevel?: 0 | 1 | 2 | 3;
  spacing?: 'tight' | 'normal' | 'roomy';
  theme?: 'light' | 'dark' | 'auto';
}

interface MediaMemoryNode {
  id: string;
  projectId: string;
  attachmentId: string;
  preprocessJobId: string;
  kind: MediaMemoryKind;
  title?: string;
  summary: string;
  layoutTypes: string[];
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColors: string[];
  styleHints: MediaMemoryStyleHints;
  entities: string[];
  components: string[];
  tags: MediaMemoryTag[];
  createdAt: number;
  updatedAt: number;
}

interface MediaMemoryEdge {
  id: string;
  projectId: string;
  fromMemoryId: string;
  toMemoryId: string;
  type: MediaMemoryEdgeType;
  score: number;
  createdAt: number;
}

// =============================================================================
// Similarity Helpers (inline for API route)
// =============================================================================

function colorSimilarity(color1: string, color2: string): number {
  if (!color1 || !color2) return 0;
  const c1 = color1.toLowerCase();
  const c2 = color2.toLowerCase();
  if (c1 === c2) return 1;

  // Simple hex distance calculation
  if (c1.startsWith('#') && c2.startsWith('#')) {
    const r1 = parseInt(c1.slice(1, 3), 16) || 0;
    const g1 = parseInt(c1.slice(3, 5), 16) || 0;
    const b1 = parseInt(c1.slice(5, 7), 16) || 0;
    const r2 = parseInt(c2.slice(1, 3), 16) || 0;
    const g2 = parseInt(c2.slice(3, 5), 16) || 0;
    const b2 = parseInt(c2.slice(5, 7), 16) || 0;
    const dist = Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
    return Math.max(0, 1 - dist / 441.67);
  }
  return 0;
}

function calculateStyleSimilarity(n1: MediaMemoryNode, n2: MediaMemoryNode): number {
  let score = 0;
  let factors = 0;

  if (n1.primaryColor && n2.primaryColor) {
    score += colorSimilarity(n1.primaryColor, n2.primaryColor);
    factors++;
  }
  if (n1.secondaryColor && n2.secondaryColor) {
    score += colorSimilarity(n1.secondaryColor, n2.secondaryColor);
    factors++;
  }
  if (n1.styleHints.borderRadius === n2.styleHints.borderRadius) { score += 1; factors++; }
  if (n1.styleHints.theme === n2.styleHints.theme) { score += 1; factors++; }

  return factors > 0 ? score / factors : 0;
}

function calculateLayoutSimilarity(n1: MediaMemoryNode, n2: MediaMemoryNode): number {
  const s1 = new Set(n1.layoutTypes);
  const s2 = new Set(n2.layoutTypes);
  if (s1.size === 0 || s2.size === 0) return 0;
  const intersection = [...s1].filter(t => s2.has(t)).length;
  const union = new Set([...s1, ...s2]).size;
  return union > 0 ? intersection / union : 0;
}

function calculateEntityOverlap(n1: MediaMemoryNode, n2: MediaMemoryNode): number {
  const e1 = n1.entities.map(e => e.toLowerCase());
  const e2 = n2.entities.map(e => e.toLowerCase());
  if (e1.length === 0 || e2.length === 0) return 0;
  const overlap = e1.filter(a => e2.some(b => a.includes(b) || b.includes(a))).length;
  return overlap / Math.max(e1.length, e2.length);
}

// =============================================================================
// GET: Get Node (with optional graph/similar)
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  console.log('[165.5][API] GET memory node:', nodeId);

  try {
    const { searchParams } = new URL(request.url);
    const includeGraph = searchParams.get('graph') === 'true';
    const includeSimilar = searchParams.get('similar') === 'true';
    const similarLimit = parseInt(searchParams.get('similarLimit') || '5', 10);

    // Get node
    const nodeDoc = await db.collection('mediaMemoryNodes').doc(nodeId).get();

    if (!nodeDoc.exists) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const node = nodeDoc.data() as MediaMemoryNode;

    // Build response
    const response: {
      success: boolean;
      node: MediaMemoryNode;
      edges?: MediaMemoryEdge[];
      connectedNodes?: MediaMemoryNode[];
      similarNodes?: { node: MediaMemoryNode; score: number; matchedOn: string[] }[];
    } = {
      success: true,
      node,
    };

    // Include graph (edges + connected nodes)
    if (includeGraph) {
      // Get edges from this node
      const edgesFromSnap = await db
        .collection('mediaMemoryEdges')
        .where('fromMemoryId', '==', nodeId)
        .get();

      const edgesToSnap = await db
        .collection('mediaMemoryEdges')
        .where('toMemoryId', '==', nodeId)
        .get();

      const edges = [
        ...edgesFromSnap.docs.map(d => d.data() as MediaMemoryEdge),
        ...edgesToSnap.docs.map(d => d.data() as MediaMemoryEdge),
      ];

      // Get connected node IDs
      const connectedIds = new Set<string>();
      edges.forEach(e => {
        if (e.fromMemoryId !== nodeId) connectedIds.add(e.fromMemoryId);
        if (e.toMemoryId !== nodeId) connectedIds.add(e.toMemoryId);
      });

      // Fetch connected nodes
      const connectedNodes: MediaMemoryNode[] = [];
      for (const id of connectedIds) {
        const doc = await db.collection('mediaMemoryNodes').doc(id).get();
        if (doc.exists) {
          connectedNodes.push(doc.data() as MediaMemoryNode);
        }
      }

      response.edges = edges;
      response.connectedNodes = connectedNodes;
    }

    // Include similar nodes (calculated on-the-fly)
    if (includeSimilar) {
      // Get other nodes in same project
      const othersSnap = await db
        .collection('mediaMemoryNodes')
        .where('projectId', '==', node.projectId)
        .limit(100)
        .get();

      const others = othersSnap.docs
        .map(d => d.data() as MediaMemoryNode)
        .filter(n => n.id !== nodeId);

      // Calculate similarity scores
      const scored = others.map(other => {
        const style = calculateStyleSimilarity(node, other);
        const layout = calculateLayoutSimilarity(node, other);
        const entity = calculateEntityOverlap(node, other);

        const matchedOn: string[] = [];
        if (style > 0.5) matchedOn.push('style');
        if (layout > 0.5) matchedOn.push('layout');
        if (entity > 0.3) matchedOn.push('entity');

        const score = (style * 0.3 + layout * 0.4 + entity * 0.3);

        return { node: other, score, matchedOn };
      });

      // Sort by score and take top N
      scored.sort((a, b) => b.score - a.score);
      response.similarNodes = scored.slice(0, similarLimit).filter(s => s.score > 0.2);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[165.5][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH: Update Node
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  console.log('[165.5][API] PATCH memory node:', nodeId);

  try {
    const body = await request.json();
    const {
      title,
      summary,
      layoutTypes,
      primaryColor,
      secondaryColor,
      accentColors,
      styleHints,
      entities,
      components,
      tags,
    } = body;

    // Check if node exists
    const nodeRef = db.collection('mediaMemoryNodes').doc(nodeId);
    const nodeDoc = await nodeRef.get();

    if (!nodeDoc.exists) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (title !== undefined) updates.title = title;
    if (summary !== undefined) updates.summary = summary;
    if (layoutTypes !== undefined) updates.layoutTypes = layoutTypes;
    if (primaryColor !== undefined) updates.primaryColor = primaryColor;
    if (secondaryColor !== undefined) updates.secondaryColor = secondaryColor;
    if (accentColors !== undefined) updates.accentColors = accentColors;
    if (styleHints !== undefined) updates.styleHints = styleHints;
    if (entities !== undefined) updates.entities = entities;
    if (components !== undefined) updates.components = components;
    if (tags !== undefined) updates.tags = tags;

    // Update
    await nodeRef.update(updates);

    // Get updated node
    const updatedDoc = await nodeRef.get();

    return NextResponse.json({
      success: true,
      node: updatedDoc.data() as MediaMemoryNode,
    });
  } catch (error) {
    console.error('[165.5][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE: Delete Node
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  console.log('[165.5][API] DELETE memory node:', nodeId);

  try {
    // Delete all edges connected to this node
    const edgesFromSnap = await db
      .collection('mediaMemoryEdges')
      .where('fromMemoryId', '==', nodeId)
      .get();

    const edgesToSnap = await db
      .collection('mediaMemoryEdges')
      .where('toMemoryId', '==', nodeId)
      .get();

    const batch = db.batch();

    edgesFromSnap.docs.forEach(doc => batch.delete(doc.ref));
    edgesToSnap.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('mediaMemoryNodes').doc(nodeId));

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Node ${nodeId} and its edges deleted`,
      deletedEdges: edgesFromSnap.size + edgesToSnap.size,
    });
  } catch (error) {
    console.error('[165.5][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
