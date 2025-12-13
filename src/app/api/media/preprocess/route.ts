// src/app/api/media/preprocess/route.ts
// =============================================================================
// Phase 164.6 + 165.4 – Media Preprocess API with Auto-Memory
// POST: Create preprocessing job (auto-creates memory node)
// GET: List results or get result by attachment
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '@/lib/server/firebase';

export const dynamic = 'force-dynamic';

// Initialize Firebase
initFirebaseAdmin();
const db = getFirestore();

// =============================================================================
// Types (mirrored from orchestrator)
// =============================================================================

type MediaKind = 'image' | 'pdf' | 'audio';
type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';

interface MediaPreprocessJob {
  id: string;
  projectId: string;
  attachmentId: string;
  kind: MediaKind;
  status: JobStatus;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

interface OcrBlock {
  id: string;
  text: string;
  bbox: [number, number, number, number];
  fontSize?: number;
  fontWeight?: string;
  confidence?: number;
}

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
  kind: MediaKind;
  summary: string;
  textBlocks: OcrBlock[];
  layoutRegions: LayoutRegion[];
  style: StylePalette | null;
  entities: MediaEntity[];
  createdAt: number;
  processingTimeMs?: number;
}

// =============================================================================
// Helpers
// =============================================================================

function generateId(prefix = 'mpj'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Mock preprocess function (runs the engine logic)
async function runPreprocess(job: MediaPreprocessJob): Promise<MediaPreprocessResult> {
  console.log(`[164.6][API] Running ${job.kind} preprocessing for ${job.attachmentId}`);

  // Import engine dynamically to avoid bundling issues
  // For now, inline mock results based on kind

  const baseResult = {
    id: job.id,
    projectId: job.projectId,
    attachmentId: job.attachmentId,
    createdAt: Date.now(),
    processingTimeMs: 150,
  };

  if (job.kind === 'image') {
    return {
      ...baseResult,
      kind: 'image',
      summary: 'Dashboard UI with navigation bar, sidebar, stat cards, chart, data table. Contains 9 distinct regions and 9 text elements. Detected 3 metrics/KPIs. Design uses dark theme with rounded corners.',
      textBlocks: [
        { id: generateId('ocr'), text: 'Dashboard', bbox: [0.02, 0.02, 0.15, 0.04], fontSize: 24, fontWeight: 'bold', confidence: 0.98 },
        { id: generateId('ocr'), text: 'Total Users', bbox: [0.05, 0.15, 0.20, 0.03], fontSize: 14, confidence: 0.95 },
        { id: generateId('ocr'), text: '12,458', bbox: [0.05, 0.19, 0.15, 0.05], fontSize: 28, fontWeight: 'bold', confidence: 0.99 },
        { id: generateId('ocr'), text: 'Revenue', bbox: [0.30, 0.15, 0.15, 0.03], fontSize: 14, confidence: 0.96 },
        { id: generateId('ocr'), text: '$45,230', bbox: [0.30, 0.19, 0.18, 0.05], fontSize: 28, fontWeight: 'bold', confidence: 0.98 },
      ],
      layoutRegions: [
        { id: generateId('region'), type: 'navbar', bbox: [0, 0, 1, 0.08], label: 'Top Navigation' },
        { id: generateId('region'), type: 'sidebar', bbox: [0, 0.08, 0.18, 0.92], label: 'Side Navigation' },
        { id: generateId('region'), type: 'card', bbox: [0.02, 0.12, 0.25, 0.18], label: 'Users Stats Card' },
        { id: generateId('region'), type: 'card', bbox: [0.28, 0.12, 0.25, 0.18], label: 'Revenue Stats Card' },
        { id: generateId('region'), type: 'chart', bbox: [0.02, 0.32, 0.55, 0.35], label: 'Main Chart Area' },
        { id: generateId('region'), type: 'table', bbox: [0.02, 0.70, 0.96, 0.28], label: 'Data Table' },
      ],
      style: {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        accents: ['#10b981', '#f59e0b', '#ef4444'],
        background: '#0f172a',
        textColor: '#f8fafc',
        borderRadiusHint: 'lg',
        shadowLevelHint: 2,
        spacingHint: 'normal',
      },
      entities: [
        { id: generateId('entity'), type: 'metric', name: 'Total Users', value: '12,458' },
        { id: generateId('entity'), type: 'metric', name: 'Revenue', value: '$45,230' },
        { id: generateId('entity'), type: 'component', name: 'Users Stats Card' },
        { id: generateId('entity'), type: 'component', name: 'Revenue Stats Card' },
        { id: generateId('entity'), type: 'component', name: 'Main Chart' },
      ],
    };
  }

  if (job.kind === 'pdf') {
    return {
      ...baseResult,
      kind: 'pdf',
      summary: 'PDF document with 3 pages. Title: "Product Requirements Document". Contains requirements including dashboard features, real-time charts, and stats components.',
      textBlocks: [
        { id: generateId('ocr'), text: 'Product Requirements Document', bbox: [0.1, 0.05, 0.8, 0.05], fontSize: 24, fontWeight: 'bold', confidence: 0.98 },
        { id: generateId('ocr'), text: 'Overview', bbox: [0.1, 0.15, 0.3, 0.03], fontSize: 18, fontWeight: 'bold', confidence: 0.96 },
        { id: generateId('ocr'), text: 'This document outlines the requirements for the new dashboard feature.', bbox: [0.1, 0.20, 0.8, 0.05], fontSize: 12, confidence: 0.94 },
      ],
      layoutRegions: [
        { id: generateId('region'), type: 'header', bbox: [0.1, 0.05, 0.8, 0.08], label: 'Document Title' },
        { id: generateId('region'), type: 'section', bbox: [0.1, 0.15, 0.8, 0.15], label: 'Overview Section' },
      ],
      style: null,
      entities: [
        { id: generateId('entity'), type: 'requirement', name: 'Dashboard Feature', description: 'New dashboard with analytics' },
        { id: generateId('entity'), type: 'feature', name: 'Real-time Charts', description: 'Display live data updates' },
        { id: generateId('entity'), type: 'component', name: 'Stats Cards', description: 'KPI display components' },
      ],
    };
  }

  if (job.kind === 'audio') {
    return {
      ...baseResult,
      kind: 'audio',
      summary: 'Audio recording (3:00 duration) with 2 speakers. Discussion covers dashboard requirements including KPI cards, activity charts, and transactions table. Contains 1 question and 2 instructions.',
      textBlocks: [
        { id: generateId('ocr'), text: 'Let\'s discuss the new dashboard requirements. We need three main KPI cards at the top.', bbox: [0, 0, 1, 0.08], confidence: 0.95 },
        { id: generateId('ocr'), text: 'Should the cards show real-time data or is cached data acceptable?', bbox: [0, 0.09, 1, 0.08], confidence: 0.93 },
        { id: generateId('ocr'), text: 'Real-time would be ideal, but we can start with 5-minute refresh intervals.', bbox: [0, 0.17, 1, 0.08], confidence: 0.96 },
      ],
      layoutRegions: [],
      style: null,
      entities: [
        { id: generateId('entity'), type: 'component', name: 'KPI Cards' },
        { id: generateId('entity'), type: 'component', name: 'Activity Chart' },
        { id: generateId('entity'), type: 'component', name: 'Transactions Table' },
        { id: generateId('entity'), type: 'requirement', name: '5-minute refresh' },
      ],
    };
  }

  throw new Error(`Unsupported kind: ${job.kind}`);
}

// =============================================================================
// Phase 165.4: Auto-create memory node from preprocessing result
// =============================================================================

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
  kind: MediaKind;
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
  conversationId?: string;
  turnId?: string;
  createdBy?: string;
}

function isColorDark(color: string): boolean {
  const darkPatterns = ['#0', '#1', '#2', '#3', '#000', '#111', '#222', '#333', 'black', 'dark'];
  return darkPatterns.some(p => color.toLowerCase().includes(p));
}

async function createMemoryNodeFromResult(
  result: MediaPreprocessResult,
  options?: { conversationId?: string; turnId?: string; createdBy?: string }
): Promise<MediaMemoryNode | null> {
  console.log('[165.4][API] Creating memory node from preprocess result:', result.id);

  try {
    // Extract layout types
    const layoutTypes = [...new Set(result.layoutRegions.map(r => r.type))];

    // Extract components from layout regions and entities
    const components: string[] = [];
    result.layoutRegions.forEach(r => {
      if (r.label) {
        const name = r.label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('').replace(/[^a-zA-Z0-9]/g, '');
        if (name) components.push(name);
      }
    });
    result.entities.filter(e => e.type === 'component').forEach(e => {
      const name = e.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('').replace(/[^a-zA-Z0-9]/g, '');
      if (name) components.push(name);
    });

    // Extract entities (non-component)
    const entities = result.entities.filter(e => e.type !== 'component').map(e => e.name);

    // Build auto tags
    const tags: MediaMemoryTag[] = [
      { key: 'kind', value: result.kind, source: 'auto', confidence: 1.0 },
    ];
    layoutTypes.forEach(lt => tags.push({ key: 'layout', value: lt, source: 'auto', confidence: 0.9 }));
    result.entities.forEach(e => tags.push({ key: 'entity_type', value: e.type, source: 'auto', confidence: 0.85 }));

    // Theme detection
    if (result.style?.background) {
      tags.push({ key: 'theme', value: isColorDark(result.style.background) ? 'dark' : 'light', source: 'auto', confidence: 0.8 });
    }

    // Style hints
    const styleHints: MediaMemoryStyleHints = {
      borderRadius: (result.style?.borderRadiusHint as MediaMemoryStyleHints['borderRadius']) || 'md',
      shadowLevel: (result.style?.shadowLevelHint as MediaMemoryStyleHints['shadowLevel']) || 1,
      spacing: (result.style?.spacingHint as MediaMemoryStyleHints['spacing']) || 'normal',
      theme: result.style?.background ? (isColorDark(result.style.background) ? 'dark' : 'light') : 'auto',
    };

    // Extract title from text blocks
    let title: string | undefined;
    const titleBlock = result.textBlocks.find(b => (b.fontSize && b.fontSize >= 20) || b.fontWeight === 'bold');
    if (titleBlock) title = titleBlock.text.slice(0, 100);

    const now = Date.now();
    const memoryNode: MediaMemoryNode = {
      id: `mem_${now}_${Math.random().toString(36).slice(2, 8)}`,
      projectId: result.projectId,
      attachmentId: result.attachmentId,
      preprocessJobId: result.id,
      kind: result.kind,
      title,
      summary: result.summary,
      layoutTypes,
      primaryColor: result.style?.primary || null,
      secondaryColor: result.style?.secondary || null,
      accentColors: result.style?.accents || [],
      styleHints,
      entities,
      components: [...new Set(components)],
      tags,
      createdAt: now,
      updatedAt: now,
      conversationId: options?.conversationId,
      turnId: options?.turnId,
      createdBy: options?.createdBy,
    };

    // Save to Firestore
    await db.collection('mediaMemoryNodes').doc(memoryNode.id).set(memoryNode);
    console.log('[165.4][API] Created memory node:', memoryNode.id);

    return memoryNode;
  } catch (err) {
    console.error('[165.4][API] Error creating memory node:', err);
    return null;
  }
}

// =============================================================================
// POST: Create Preprocessing Job
// =============================================================================

export async function POST(request: NextRequest) {
  console.log('[164.6 + 165.4][API] POST /api/media/preprocess');

  try {
    const body = await request.json();
    const { projectId, attachmentId, kind, conversationId, turnId, createdBy, skipMemory } = body;

    // Validation
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!attachmentId) {
      return NextResponse.json({ error: 'attachmentId is required' }, { status: 400 });
    }
    if (!kind || !['image', 'pdf', 'audio'].includes(kind)) {
      return NextResponse.json({ error: 'kind must be "image", "pdf", or "audio"' }, { status: 400 });
    }

    const now = Date.now();
    const jobId = generateId('mpj');

    // Create job
    const job: MediaPreprocessJob = {
      id: jobId,
      projectId,
      attachmentId,
      kind,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    // Save job
    await db.collection('mediaPreprocessJobs').doc(jobId).set(job);

    // Update status to RUNNING
    await db.collection('mediaPreprocessJobs').doc(jobId).update({
      status: 'RUNNING',
      updatedAt: Date.now(),
    });

    // Run preprocessing
    let result: MediaPreprocessResult;
    try {
      result = await runPreprocess(job);

      // Save result
      await db.collection('mediaPreprocessResults').doc(jobId).set(result);

      // Update job to DONE
      await db.collection('mediaPreprocessJobs').doc(jobId).update({
        status: 'DONE',
        updatedAt: Date.now(),
      });

      // Phase 165.4: Auto-create memory node (unless skipMemory is true)
      let memoryNode: MediaMemoryNode | null = null;
      if (!skipMemory) {
        memoryNode = await createMemoryNodeFromResult(result, {
          conversationId,
          turnId,
          createdBy,
        });
      }

      console.log('[164.6 + 165.4][API] Job completed:', jobId, memoryNode ? `memory: ${memoryNode.id}` : '(no memory)');

      return NextResponse.json({
        success: true,
        jobId,
        status: 'DONE',
        result,
        memoryNodeId: memoryNode?.id,
        memoryNode,
      });
    } catch (err) {
      // Update job to ERROR
      await db.collection('mediaPreprocessJobs').doc(jobId).update({
        status: 'ERROR',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        updatedAt: Date.now(),
      });

      return NextResponse.json({
        success: false,
        jobId,
        status: 'ERROR',
        error: err instanceof Error ? err.message : 'Unknown error',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[164.6][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET: List Results or Get by Attachment
// =============================================================================

export async function GET(request: NextRequest) {
  console.log('[164.6][API] GET /api/media/preprocess');

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const attachmentId = searchParams.get('attachmentId');
    const kind = searchParams.get('kind') as MediaKind | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // If attachmentId provided, get specific result
    if (attachmentId) {
      const snap = await db
        .collection('mediaPreprocessResults')
        .where('projectId', '==', projectId)
        .where('attachmentId', '==', attachmentId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (snap.empty) {
        return NextResponse.json({
          success: true,
          result: null,
          message: 'No preprocessing result found for this attachment',
        });
      }

      return NextResponse.json({
        success: true,
        result: snap.docs[0].data() as MediaPreprocessResult,
      });
    }

    // Otherwise, list results
    let query = db
      .collection('mediaPreprocessResults')
      .where('projectId', '==', projectId);

    if (kind) {
      query = query.where('kind', '==', kind);
    }

    const snap = await query.orderBy('createdAt', 'desc').limit(limit).get();

    const results = snap.docs.map((doc) => doc.data() as MediaPreprocessResult);

    return NextResponse.json({
      success: true,
      results,
      total: results.length,
    });
  } catch (error) {
    console.error('[164.6][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
