// src/app/api/ui/generate/route.ts
// =============================================================================
// Phase 163.2 + 164.7 + 165.6 – UI Generation API Endpoint
// POST: Create UI generation request from media (with preprocessing + memory)
// GET: List proposals for a project
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '@/lib/server/firebase';

// Initialize Firebase
initFirebaseAdmin();
const db = getFirestore();

// =============================================================================
// Phase 164 Types (for preprocessing integration)
// =============================================================================

interface LayoutRegion {
  id: string;
  type: string;
  bbox: [number, number, number, number];
  label?: string;
}

interface StylePalette {
  primary: string | null;
  secondary: string | null;
  accents: string[];
  background: string | null;
  textColor: string | null;
  borderRadiusHint?: string;
  shadowLevelHint?: number;
  spacingHint?: string;
}

interface MediaEntity {
  id: string;
  type: string;
  name: string;
  value?: string;
  description?: string;
}

interface MediaPreprocessResult {
  id: string;
  projectId: string;
  attachmentId: string;
  kind: 'image' | 'pdf' | 'audio';
  summary: string;
  textBlocks: unknown[];
  layoutRegions: LayoutRegion[];
  style: StylePalette | null;
  entities: MediaEntity[];
}

// =============================================================================
// Phase 165.6 Types (for memory integration)
// =============================================================================

interface MediaMemoryNode {
  id: string;
  projectId: string;
  attachmentId: string;
  preprocessJobId: string;
  kind: 'image' | 'pdf' | 'audio';
  title?: string;
  summary: string;
  layoutTypes: string[];
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColors: string[];
  styleHints: {
    borderRadius?: string;
    shadowLevel?: number;
    spacing?: string;
    theme?: string;
  };
  entities: string[];
  components: string[];
}

interface MemoryRecommendations {
  similarDesigns: MediaMemoryNode[];
  suggestedComponents: string[];
  colorPalette: {
    primary?: string;
    secondary?: string;
    accents: string[];
  };
}

// =============================================================================
// Types (mirrored from orchestrator for API layer)
// =============================================================================

type UiGenerationMode = 'page' | 'component' | 'dashboard' | 'form';
type UiGenerationStatus =
  | 'pending'
  | 'analyzing'
  | 'generating'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'building'
  | 'completed'
  | 'failed';

interface UiComponentNode {
  id: string;
  name: string;
  type: 'page' | 'layout' | 'component' | 'section' | 'element';
  description?: string;
  props?: Record<string, unknown>;
  children?: UiComponentNode[];
  suggestedPath?: string;
  dependencies?: string[];
  imports?: string[];
  visualHints?: {
    layout?: 'flex' | 'grid' | 'block';
    spacing?: 'tight' | 'normal' | 'loose';
    colors?: string[];
    typography?: string[];
  };
}

interface UiFilePlan {
  componentId: string;
  path: string;
  action: 'create' | 'modify';
  estimatedLines?: number;
  dependencies?: string[];
}

interface UiGenerationRequest {
  id: string;
  projectId: string;
  attachmentIds: string[];
  mode: UiGenerationMode;
  targetPath?: string;
  framework?: 'nextjs' | 'react';
  styling?: 'tailwind' | 'shadcn' | 'plain';
  createdBy: string;
  createdAt: string;
  conversationId?: string;
  turnId?: string;
  instructions?: string;
  constraints?: string[];
}

interface UiGenerationProposal {
  id: string;
  requestId: string;
  projectId: string;
  status: UiGenerationStatus;
  createdAt: string;
  updatedAt: string;
  analysisNotes?: string;
  componentTree: UiComponentNode[];
  filePlan: UiFilePlan[];
  planId?: string;
  taskIds?: string[];
  errorMessage?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Phase 164.7: Get preprocessing result if available
async function getPreprocessResult(
  projectId: string,
  attachmentId: string
): Promise<MediaPreprocessResult | null> {
  try {
    const snap = await db
      .collection('mediaPreprocessResults')
      .where('projectId', '==', projectId)
      .where('attachmentId', '==', attachmentId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as MediaPreprocessResult;
  } catch (err) {
    console.log('[164.7][API] No preprocess result found, using fallback');
    return null;
  }
}

// Phase 165.6: Get memory node for attachment
async function getMemoryNode(
  projectId: string,
  attachmentId: string
): Promise<MediaMemoryNode | null> {
  try {
    const snap = await db
      .collection('mediaMemoryNodes')
      .where('projectId', '==', projectId)
      .where('attachmentId', '==', attachmentId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as MediaMemoryNode;
  } catch (err) {
    console.log('[165.6][API] No memory node found');
    return null;
  }
}

// Phase 165.6: Get recommendations from similar memories
async function getMemoryRecommendations(
  projectId: string,
  memoryNode: MediaMemoryNode
): Promise<MemoryRecommendations> {
  console.log('[165.6][API] Getting memory recommendations for:', memoryNode.id);

  try {
    // Get other memory nodes in the project
    const snap = await db
      .collection('mediaMemoryNodes')
      .where('projectId', '==', projectId)
      .limit(50)
      .get();

    const others = snap.docs
      .map(d => d.data() as MediaMemoryNode)
      .filter(n => n.id !== memoryNode.id);

    if (others.length === 0) {
      return {
        similarDesigns: [],
        suggestedComponents: [],
        colorPalette: {
          primary: memoryNode.primaryColor || undefined,
          secondary: memoryNode.secondaryColor || undefined,
          accents: memoryNode.accentColors || [],
        },
      };
    }

    // Calculate similarity and sort
    const scored = others.map(other => {
      // Layout similarity (Jaccard)
      const l1 = new Set(memoryNode.layoutTypes);
      const l2 = new Set(other.layoutTypes);
      const layoutIntersection = [...l1].filter(t => l2.has(t)).length;
      const layoutUnion = new Set([...l1, ...l2]).size;
      const layoutScore = layoutUnion > 0 ? layoutIntersection / layoutUnion : 0;

      // Style similarity
      let styleScore = 0;
      if (memoryNode.primaryColor && other.primaryColor && memoryNode.primaryColor === other.primaryColor) {
        styleScore += 0.5;
      }
      if (memoryNode.styleHints?.theme === other.styleHints?.theme) {
        styleScore += 0.5;
      }

      const totalScore = layoutScore * 0.6 + styleScore * 0.4;
      return { node: other, score: totalScore };
    });

    scored.sort((a, b) => b.score - a.score);
    const similarDesigns = scored.slice(0, 5).filter(s => s.score > 0.2).map(s => s.node);

    // Aggregate suggested components from similar designs
    const componentCounts = new Map<string, number>();
    similarDesigns.forEach(design => {
      design.components.forEach(comp => {
        componentCounts.set(comp, (componentCounts.get(comp) || 0) + 1);
      });
    });

    const suggestedComponents = [...componentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([comp]) => comp);

    // Build color palette from similar designs
    const primaryColors = similarDesigns.map(d => d.primaryColor).filter(Boolean) as string[];
    const secondaryColors = similarDesigns.map(d => d.secondaryColor).filter(Boolean) as string[];
    const accentColors = similarDesigns.flatMap(d => d.accentColors);

    const mostCommon = <T>(arr: T[]): T | undefined => {
      if (arr.length === 0) return undefined;
      const counts = new Map<T, number>();
      arr.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
      let max: T | undefined;
      let maxCount = 0;
      counts.forEach((count, item) => {
        if (count > maxCount) {
          maxCount = count;
          max = item;
        }
      });
      return max;
    };

    return {
      similarDesigns,
      suggestedComponents,
      colorPalette: {
        primary: mostCommon(primaryColors) || memoryNode.primaryColor || undefined,
        secondary: mostCommon(secondaryColors) || memoryNode.secondaryColor || undefined,
        accents: [...new Set(accentColors)].slice(0, 3),
      },
    };
  } catch (err) {
    console.error('[165.6][API] Error getting recommendations:', err);
    return {
      similarDesigns: [],
      suggestedComponents: memoryNode.components || [],
      colorPalette: {
        primary: memoryNode.primaryColor || undefined,
        secondary: memoryNode.secondaryColor || undefined,
        accents: memoryNode.accentColors || [],
      },
    };
  }
}

// Phase 164.7: Convert layout region to component node
function layoutRegionToComponent(region: LayoutRegion, style: StylePalette | null): UiComponentNode {
  const typeToComponentType: Record<string, UiComponentNode['type']> = {
    navbar: 'section',
    sidebar: 'section',
    header: 'section',
    footer: 'section',
    card: 'component',
    chart: 'component',
    table: 'component',
    form: 'component',
    grid: 'section',
    list: 'component',
    modal: 'component',
    button: 'element',
    input: 'element',
    image: 'element',
    section: 'section',
    hero: 'section',
    unknown: 'section',
  };

  const layoutMap: Record<string, 'flex' | 'grid' | 'block'> = {
    navbar: 'flex',
    sidebar: 'flex',
    header: 'flex',
    footer: 'flex',
    grid: 'grid',
    card: 'block',
    table: 'block',
  };

  return {
    id: region.id || generateId('comp'),
    name: region.label || `${region.type.charAt(0).toUpperCase()}${region.type.slice(1)}`,
    type: typeToComponentType[region.type] || 'section',
    description: region.label || `${region.type} component`,
    visualHints: {
      layout: layoutMap[region.type] || 'block',
      spacing: (style?.spacingHint as 'tight' | 'normal' | 'loose') || 'normal',
      colors: style ? [style.primary, style.secondary].filter(Boolean) as string[] : undefined,
    },
  };
}

// Phase 164.7: Build component tree from preprocessing result
function buildTreeFromPreprocessResult(
  result: MediaPreprocessResult,
  mode: UiGenerationMode
): { componentTree: UiComponentNode[]; filePlan: UiFilePlan[] } {
  const { layoutRegions, style, entities, summary } = result;

  // Group regions by type for hierarchy
  const navbar = layoutRegions.find(r => r.type === 'navbar');
  const sidebar = layoutRegions.find(r => r.type === 'sidebar');
  const header = layoutRegions.find(r => r.type === 'header');
  const footer = layoutRegions.find(r => r.type === 'footer');
  const contentRegions = layoutRegions.filter(r =>
    !['navbar', 'sidebar', 'header', 'footer'].includes(r.type)
  );

  // Build children from content regions
  const contentChildren: UiComponentNode[] = contentRegions.map(region =>
    layoutRegionToComponent(region, style)
  );

  // Build main content section
  const mainContent: UiComponentNode = {
    id: generateId('comp'),
    name: 'MainContent',
    type: 'section',
    description: 'Main content area with detected components',
    children: contentChildren.length > 0 ? contentChildren : [
      {
        id: generateId('comp'),
        name: 'ContentArea',
        type: 'component',
        description: 'Primary content area',
      },
    ],
    visualHints: {
      layout: 'grid',
      spacing: (style?.spacingHint as 'tight' | 'normal' | 'loose') || 'normal',
    },
  };

  // Build root component with proper structure
  const rootChildren: UiComponentNode[] = [];
  if (navbar) rootChildren.push(layoutRegionToComponent(navbar, style));
  if (header) rootChildren.push(layoutRegionToComponent(header, style));
  if (sidebar) {
    // Wrap sidebar + main content in a layout
    rootChildren.push({
      id: generateId('comp'),
      name: 'LayoutWrapper',
      type: 'layout',
      description: 'Sidebar + content layout',
      children: [
        layoutRegionToComponent(sidebar, style),
        mainContent,
      ],
      visualHints: { layout: 'flex', spacing: 'normal' },
    });
  } else {
    rootChildren.push(mainContent);
  }
  if (footer) rootChildren.push(layoutRegionToComponent(footer, style));

  const rootComponent: UiComponentNode = {
    id: generateId('comp'),
    name: mode === 'dashboard' ? 'Dashboard' : 'GeneratedPage',
    type: 'page',
    description: summary || `Auto-generated ${mode} from media analysis`,
    children: rootChildren,
    visualHints: {
      layout: 'flex',
      spacing: (style?.spacingHint as 'tight' | 'normal' | 'loose') || 'normal',
      colors: style ? [style.primary, style.secondary, ...style.accents].filter(Boolean) as string[] : undefined,
    },
  };

  // Generate file plan
  const filePlan: UiFilePlan[] = [
    {
      componentId: rootComponent.id,
      path: `src/app/generated/${mode}/page.tsx`,
      action: 'create',
      estimatedLines: 120,
      dependencies: ['@/components/ui/card', '@/components/ui/button'],
    },
  ];

  // Add files for each content component
  for (const child of contentChildren) {
    filePlan.push({
      componentId: child.id,
      path: `src/components/generated/${child.name.replace(/\s+/g, '')}.tsx`,
      action: 'create',
      estimatedLines: 50,
    });
  }

  return { componentTree: [rootComponent], filePlan };
}

// Analyze attachment and generate component tree
// Phase 164.7: Uses preprocessing results when available
async function analyzeAndGenerateTree(
  projectId: string,
  attachmentIds: string[],
  mode: UiGenerationMode,
  instructions?: string,
  preprocessJobId?: string
): Promise<{ analysisNotes: string; componentTree: UiComponentNode[]; filePlan: UiFilePlan[] }> {
  // Phase 164.7: Try to get preprocessing result
  let preprocessResult: MediaPreprocessResult | null = null;

  if (preprocessJobId) {
    // If preprocessJobId provided, get that specific result
    const resultDoc = await db.collection('mediaPreprocessResults').doc(preprocessJobId).get();
    if (resultDoc.exists) {
      preprocessResult = resultDoc.data() as MediaPreprocessResult;
    }
  } else if (attachmentIds.length > 0) {
    // Try to find existing preprocessing result for the first attachment
    preprocessResult = await getPreprocessResult(projectId, attachmentIds[0]);
  }

  // If we have preprocessing result, use it to build smart component tree
  if (preprocessResult) {
    console.log('[164.7][API] Using preprocessing result for UI generation');

    const { componentTree, filePlan } = buildTreeFromPreprocessResult(preprocessResult, mode);

    const analysisNotes = `Built from preprocessing result (${preprocessResult.kind}). ${preprocessResult.summary}${
      instructions ? ` User instructions: "${instructions}"` : ''
    }`;

    return { analysisNotes, componentTree, filePlan };
  }

  // Fallback: Generate placeholder component tree
  console.log('[164.7][API] No preprocessing result, using fallback');

  const analysisNotes = `Analyzed ${attachmentIds.length} attachment(s) for ${mode} generation.${
    instructions ? ` User instructions: "${instructions}"` : ''
  }`;

  const rootComponent: UiComponentNode = {
    id: generateId('comp'),
    name: mode === 'page' ? 'GeneratedPage' : mode === 'dashboard' ? 'Dashboard' : 'GeneratedComponent',
    type: mode === 'page' ? 'page' : mode === 'dashboard' ? 'layout' : 'component',
    description: `Auto-generated ${mode} from media analysis`,
    children: [
      {
        id: generateId('comp'),
        name: 'Header',
        type: 'section',
        description: 'Page header with navigation',
        visualHints: { layout: 'flex', spacing: 'normal' },
      },
      {
        id: generateId('comp'),
        name: 'MainContent',
        type: 'section',
        description: 'Main content area',
        children: [
          {
            id: generateId('comp'),
            name: 'ContentCard',
            type: 'component',
            description: 'Primary content card',
          },
        ],
        visualHints: { layout: 'grid', spacing: 'normal' },
      },
      {
        id: generateId('comp'),
        name: 'Footer',
        type: 'section',
        description: 'Page footer',
        visualHints: { layout: 'flex', spacing: 'tight' },
      },
    ],
    visualHints: { layout: 'flex', spacing: 'normal' },
  };

  const filePlan: UiFilePlan[] = [
    {
      componentId: rootComponent.id,
      path: `src/app/generated/${mode}/page.tsx`,
      action: 'create',
      estimatedLines: 80,
      dependencies: ['@/components/ui/card', '@/components/ui/button'],
    },
  ];

  if (rootComponent.children) {
    for (const child of rootComponent.children) {
      filePlan.push({
        componentId: child.id,
        path: `src/components/generated/${child.name}.tsx`,
        action: 'create',
        estimatedLines: 40,
      });
    }
  }

  return {
    analysisNotes,
    componentTree: [rootComponent],
    filePlan,
  };
}

// =============================================================================
// POST: Create UI Generation Request
// =============================================================================

export async function POST(request: NextRequest) {
  console.log('[163.2 + 164.7][API] POST /api/ui/generate');

  try {
    const body = await request.json();
    const {
      projectId,
      attachmentIds,
      mode = 'page',
      targetPath,
      framework = 'nextjs',
      styling = 'shadcn',
      userId,
      conversationId,
      turnId,
      instructions,
      constraints,
      preprocessJobId, // Phase 164.7: Optional preprocessing job ID
    } = body;

    // Validation
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!attachmentIds || !Array.isArray(attachmentIds) || attachmentIds.length === 0) {
      return NextResponse.json({ error: 'attachmentIds array is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Create request
    const requestId = generateId('uireq');
    const uiRequest: UiGenerationRequest = {
      id: requestId,
      projectId,
      attachmentIds,
      mode,
      targetPath,
      framework,
      styling,
      createdBy: userId || 'anonymous',
      createdAt: now,
      conversationId,
      turnId,
      instructions,
      constraints,
    };

    // Save request
    await db.collection('uiGenerationRequests').doc(requestId).set(uiRequest);

    // Analyze and generate proposal (Phase 164.7: with preprocessing support)
    const { analysisNotes, componentTree, filePlan } = await analyzeAndGenerateTree(
      projectId,
      attachmentIds,
      mode,
      instructions,
      preprocessJobId
    );

    // Create proposal
    const proposalId = generateId('uiprop');
    const proposal: UiGenerationProposal = {
      id: proposalId,
      requestId,
      projectId,
      status: 'awaiting_approval',
      createdAt: now,
      updatedAt: now,
      analysisNotes,
      componentTree,
      filePlan,
    };

    // Save proposal
    await db.collection('uiGenerationProposals').doc(proposalId).set(proposal);

    // Phase 165.6: Get memory recommendations if memory exists
    let memoryRecommendations: MemoryRecommendations | null = null;
    let memoryNode: MediaMemoryNode | null = null;

    if (attachmentIds.length > 0) {
      memoryNode = await getMemoryNode(projectId, attachmentIds[0]);
      if (memoryNode) {
        memoryRecommendations = await getMemoryRecommendations(projectId, memoryNode);
        console.log('[165.6][API] Got memory recommendations:', {
          similarDesigns: memoryRecommendations.similarDesigns.length,
          suggestedComponents: memoryRecommendations.suggestedComponents.length,
        });
      }
    }

    console.log('[163.2 + 165.6][API] Created request:', requestId, 'proposal:', proposalId);

    return NextResponse.json({
      success: true,
      request: uiRequest,
      proposal,
      memoryNodeId: memoryNode?.id,
      memoryRecommendations,
    });
  } catch (error) {
    console.error('[163.2][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET: List Proposals
// =============================================================================

export async function GET(request: NextRequest) {
  console.log('[163.2][API] GET /api/ui/generate');

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status') as UiGenerationStatus | null;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    let query = db
      .collection('uiGenerationProposals')
      .where('projectId', '==', projectId);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();

    const proposals = snap.docs.map((doc) => doc.data() as UiGenerationProposal);

    console.log('[163.2][API] Found', proposals.length, 'proposals');

    return NextResponse.json({
      success: true,
      proposals,
      total: proposals.length,
    });
  } catch (error) {
    console.error('[163.2][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
