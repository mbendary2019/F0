// orchestrator/core/mediaMemory/mediaMemoryBuilder.ts
// =============================================================================
// Phase 165.2 – Memory Builder from Phase 164 Preprocessing Results
// =============================================================================

import { getFirestore } from 'firebase-admin/firestore';
import {
  MediaMemoryNode,
  MediaMemoryTag,
  MediaMemoryStyleHints,
  CreateMemoryFromPreprocessInput,
} from './types';
import { getMediaMemoryStore } from './firestoreMediaMemoryStore';

// Type for preprocessing result (from Phase 164)
interface MediaPreprocessResult {
  id: string;
  projectId: string;
  attachmentId: string;
  kind: 'image' | 'pdf' | 'audio';
  summary: string;
  textBlocks: Array<{
    id: string;
    text: string;
    bbox: [number, number, number, number];
    fontSize?: number;
    fontWeight?: string;
  }>;
  layoutRegions: Array<{
    id: string;
    type: string;
    bbox: [number, number, number, number];
    label?: string;
  }>;
  style: {
    primary: string | null;
    secondary: string | null;
    accents: string[];
    background: string | null;
    textColor: string | null;
    borderRadiusHint?: string;
    shadowLevelHint?: number;
    spacingHint?: string;
  } | null;
  entities: Array<{
    id: string;
    type: string;
    name: string;
    value?: string;
    description?: string;
  }>;
  audioSegments?: Array<{
    id: string;
    startSec: number;
    endSec: number;
    text: string;
    speakerTag?: string;
    isQuestion?: boolean;
    isInstruction?: boolean;
    isRequirement?: boolean;
  }>;
  pdfPages?: Array<{
    pageNum: number;
    textBlocks: unknown[];
    layoutRegions: unknown[];
  }>;
  createdAt: number;
  processingTimeMs?: number;
}

/**
 * Generate a unique ID
 */
function generateId(prefix = 'mem'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract title from preprocessing result
 */
function extractTitle(result: MediaPreprocessResult): string | undefined {
  // Try to find a title from text blocks (first large text)
  const titleBlock = result.textBlocks.find(
    b => (b.fontSize && b.fontSize >= 20) || b.fontWeight === 'bold'
  );
  if (titleBlock) return titleBlock.text.slice(0, 100);

  // Try from entities
  const titleEntity = result.entities.find(
    e => e.type === 'title' || e.type === 'heading'
  );
  if (titleEntity) return titleEntity.name;

  // Default based on kind
  return undefined;
}

/**
 * Extract layout types from regions
 */
function extractLayoutTypes(result: MediaPreprocessResult): string[] {
  const types = new Set<string>();
  result.layoutRegions.forEach(r => types.add(r.type));
  return Array.from(types);
}

/**
 * Extract component names from regions and entities
 */
function extractComponents(result: MediaPreprocessResult): string[] {
  const components: string[] = [];

  // From layout regions with labels
  result.layoutRegions.forEach(r => {
    if (r.label) {
      const name = r.label
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join('')
        .replace(/[^a-zA-Z0-9]/g, '');
      if (name) components.push(name);
    }
  });

  // From entities of type 'component'
  result.entities
    .filter(e => e.type === 'component')
    .forEach(e => {
      const name = e.name
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join('')
        .replace(/[^a-zA-Z0-9]/g, '');
      if (name) components.push(name);
    });

  return [...new Set(components)];
}

/**
 * Extract entity names
 */
function extractEntities(result: MediaPreprocessResult): string[] {
  return result.entities
    .filter(e => e.type !== 'component')
    .map(e => e.name);
}

/**
 * Build auto-generated tags from preprocessing result
 */
function buildAutoTags(result: MediaPreprocessResult): MediaMemoryTag[] {
  const tags: MediaMemoryTag[] = [];

  // Kind tag
  tags.push({
    key: 'kind',
    value: result.kind,
    source: 'auto',
    confidence: 1.0,
  });

  // Layout type tags
  result.layoutRegions.forEach(r => {
    tags.push({
      key: 'layout',
      value: r.type,
      source: 'auto',
      confidence: 0.9,
    });
  });

  // Entity type tags
  result.entities.forEach(e => {
    tags.push({
      key: 'entity_type',
      value: e.type,
      source: 'auto',
      confidence: 0.85,
    });
  });

  // Theme tag from style
  if (result.style?.background) {
    const isDark = isColorDark(result.style.background);
    tags.push({
      key: 'theme',
      value: isDark ? 'dark' : 'light',
      source: 'auto',
      confidence: 0.8,
    });
  }

  // Audio-specific tags
  if (result.kind === 'audio' && result.audioSegments) {
    const hasQuestions = result.audioSegments.some(s => s.isQuestion);
    const hasInstructions = result.audioSegments.some(s => s.isInstruction);
    const speakerCount = new Set(result.audioSegments.map(s => s.speakerTag)).size;

    if (hasQuestions) {
      tags.push({ key: 'content', value: 'questions', source: 'auto', confidence: 0.85 });
    }
    if (hasInstructions) {
      tags.push({ key: 'content', value: 'instructions', source: 'auto', confidence: 0.85 });
    }
    if (speakerCount > 1) {
      tags.push({ key: 'speakers', value: String(speakerCount), source: 'auto', confidence: 0.9 });
    }
  }

  // PDF-specific tags
  if (result.kind === 'pdf' && result.pdfPages) {
    tags.push({
      key: 'pages',
      value: String(result.pdfPages.length),
      source: 'auto',
      confidence: 1.0,
    });
  }

  return tags;
}

/**
 * Check if a color is dark
 */
function isColorDark(color: string): boolean {
  // Simple check for common dark colors
  const darkPatterns = ['#0', '#1', '#2', '#3', '#000', '#111', '#222', '#333', 'black', 'dark'];
  return darkPatterns.some(p => color.toLowerCase().includes(p));
}

/**
 * Extract style hints from preprocessing result
 */
function extractStyleHints(result: MediaPreprocessResult): MediaMemoryStyleHints {
  const style = result.style;
  if (!style) {
    return { borderRadius: 'md', shadowLevel: 1, spacing: 'normal' };
  }

  return {
    borderRadius: (style.borderRadiusHint as MediaMemoryStyleHints['borderRadius']) || 'md',
    shadowLevel: (style.shadowLevelHint as MediaMemoryStyleHints['shadowLevel']) || 1,
    spacing: (style.spacingHint as MediaMemoryStyleHints['spacing']) || 'normal',
    theme: style.background ? (isColorDark(style.background) ? 'dark' : 'light') : 'auto',
  };
}

/**
 * Build a MediaMemoryNode from a MediaPreprocessResult
 */
export async function buildMemoryFromPreprocess(
  input: CreateMemoryFromPreprocessInput
): Promise<MediaMemoryNode> {
  const db = getFirestore();

  // Get the preprocessing result
  const resultDoc = await db
    .collection('mediaPreprocessResults')
    .doc(input.preprocessJobId)
    .get();

  if (!resultDoc.exists) {
    throw new Error(`Preprocessing result not found: ${input.preprocessJobId}`);
  }

  const preprocessResult = resultDoc.data() as MediaPreprocessResult;

  // Build the memory node
  const now = Date.now();
  const node: MediaMemoryNode = {
    id: generateId('mem'),
    projectId: input.projectId,
    attachmentId: input.attachmentId,
    preprocessJobId: input.preprocessJobId,
    kind: preprocessResult.kind,

    // Content
    title: input.title || extractTitle(preprocessResult),
    summary: preprocessResult.summary,

    // Layout
    layoutTypes: extractLayoutTypes(preprocessResult),

    // Style
    primaryColor: preprocessResult.style?.primary || null,
    secondaryColor: preprocessResult.style?.secondary || null,
    accentColors: preprocessResult.style?.accents || [],
    styleHints: extractStyleHints(preprocessResult),

    // Entities & Components
    entities: extractEntities(preprocessResult),
    components: extractComponents(preprocessResult),

    // Tags
    tags: [
      ...buildAutoTags(preprocessResult),
      ...(input.additionalTags || []),
    ],

    // Metadata
    conversationId: input.conversationId,
    turnId: input.turnId,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  return node;
}

/**
 * Create and persist memory from preprocessing result
 */
export async function createMemoryFromPreprocess(
  input: CreateMemoryFromPreprocessInput
): Promise<MediaMemoryNode> {
  console.log('[165.2][BUILDER] Creating memory from preprocess:', input.preprocessJobId);

  // Build the memory node
  const node = await buildMemoryFromPreprocess(input);

  // Persist to Firestore
  const store = getMediaMemoryStore();
  await store.createNode(node);

  console.log('[165.2][BUILDER] Created memory node:', node.id);
  return node;
}

/**
 * Check if memory already exists for an attachment
 */
export async function memoryExistsForAttachment(
  projectId: string,
  attachmentId: string
): Promise<boolean> {
  const store = getMediaMemoryStore();
  const existing = await store.getNodeByAttachment(projectId, attachmentId);
  return existing !== null;
}

/**
 * Get or create memory for an attachment
 */
export async function getOrCreateMemory(
  input: CreateMemoryFromPreprocessInput
): Promise<{ node: MediaMemoryNode; created: boolean }> {
  const store = getMediaMemoryStore();

  // Check if exists
  const existing = await store.getNodeByAttachment(input.projectId, input.attachmentId);
  if (existing) {
    return { node: existing, created: false };
  }

  // Create new
  const node = await createMemoryFromPreprocess(input);
  return { node, created: true };
}

console.log('[165.2][MEDIA_MEMORY] Memory builder loaded');
