// orchestrator/core/mediaPreprocess/mediaPreprocessEngine.ts
// =============================================================================
// Phase 164.2-164.5 – Media Preprocess Engine
// Orchestrates image/PDF/audio preprocessing pipelines
// =============================================================================

import {
  MediaPreprocessJob,
  MediaPreprocessResult,
  OcrBlock,
  LayoutRegion,
  LayoutRegionType,
  StylePalette,
  MediaEntity,
  AudioSegment,
  AudioMeta,
  PdfPage,
  PdfMeta,
} from './types';

// =============================================================================
// Helpers
// =============================================================================

function generateId(prefix = 'block'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// =============================================================================
// Main Engine
// =============================================================================

export interface MediaPreprocessEngineOptions {
  provider?: 'vision-api' | 'gemini' | 'whisper' | 'tesseract' | 'mock';
  debug?: boolean;
}

export async function runMediaPreprocessJob(
  job: MediaPreprocessJob,
  options: MediaPreprocessEngineOptions = {}
): Promise<MediaPreprocessResult> {
  const startTime = Date.now();
  const provider = options.provider || 'mock';

  console.log(`[164][ENGINE] Starting ${job.kind} preprocessing for ${job.attachmentId}`);

  let result: MediaPreprocessResult;

  switch (job.kind) {
    case 'image':
      result = await runImagePipeline(job, provider);
      break;
    case 'pdf':
      result = await runPdfPipeline(job, provider);
      break;
    case 'audio':
      result = await runAudioPipeline(job, provider);
      break;
    default:
      throw new Error(`Unsupported media kind: ${job.kind}`);
  }

  result.processingTimeMs = Date.now() - startTime;
  result.provider = provider;

  console.log(`[164][ENGINE] Completed ${job.kind} preprocessing in ${result.processingTimeMs}ms`);

  return result;
}

// =============================================================================
// 164.3 – Image Pipeline (OCR + Layout + Style)
// =============================================================================

async function runImagePipeline(
  job: MediaPreprocessJob,
  provider: string
): Promise<MediaPreprocessResult> {
  console.log('[164.3][IMAGE] Running image pipeline');

  // Step 1: OCR - Extract text blocks
  const textBlocks = await extractOcrBlocks(job, provider);

  // Step 2: Layout Detection - Identify UI regions
  const layoutRegions = await detectLayoutRegions(job, textBlocks, provider);

  // Step 3: Style Extraction - Colors, spacing, etc.
  const style = await extractStylePalette(job, provider);

  // Step 4: Entity Extraction - Labels, metrics, actions
  const entities = await extractEntities(textBlocks, layoutRegions, provider);

  // Step 5: Generate Summary
  const summary = await generateImageSummary(textBlocks, layoutRegions, entities, provider);

  return {
    id: job.id,
    projectId: job.projectId,
    attachmentId: job.attachmentId,
    kind: 'image',
    summary,
    textBlocks,
    layoutRegions,
    style,
    entities,
    createdAt: Date.now(),
  };
}

async function extractOcrBlocks(
  job: MediaPreprocessJob,
  provider: string
): Promise<OcrBlock[]> {
  // TODO: Integrate with Vision API / Tesseract / Gemini Vision
  // For now, return mock data

  console.log('[164.3][OCR] Extracting text blocks');

  // Mock OCR blocks for a typical dashboard UI
  return [
    {
      id: generateId('ocr'),
      text: 'Dashboard',
      bbox: [0.02, 0.02, 0.15, 0.04],
      fontSize: 24,
      fontWeight: 'bold',
      confidence: 0.98,
    },
    {
      id: generateId('ocr'),
      text: 'Total Users',
      bbox: [0.05, 0.15, 0.20, 0.03],
      fontSize: 14,
      confidence: 0.95,
    },
    {
      id: generateId('ocr'),
      text: '12,458',
      bbox: [0.05, 0.19, 0.15, 0.05],
      fontSize: 28,
      fontWeight: 'bold',
      confidence: 0.99,
    },
    {
      id: generateId('ocr'),
      text: 'Revenue',
      bbox: [0.30, 0.15, 0.15, 0.03],
      fontSize: 14,
      confidence: 0.96,
    },
    {
      id: generateId('ocr'),
      text: '$45,230',
      bbox: [0.30, 0.19, 0.18, 0.05],
      fontSize: 28,
      fontWeight: 'bold',
      confidence: 0.98,
    },
    {
      id: generateId('ocr'),
      text: 'Active Sessions',
      bbox: [0.55, 0.15, 0.22, 0.03],
      fontSize: 14,
      confidence: 0.94,
    },
    {
      id: generateId('ocr'),
      text: '1,234',
      bbox: [0.55, 0.19, 0.12, 0.05],
      fontSize: 28,
      fontWeight: 'bold',
      confidence: 0.97,
    },
    {
      id: generateId('ocr'),
      text: 'Recent Activity',
      bbox: [0.05, 0.35, 0.20, 0.03],
      fontSize: 16,
      fontWeight: 'bold',
      confidence: 0.96,
    },
    {
      id: generateId('ocr'),
      text: 'Settings',
      bbox: [0.85, 0.02, 0.10, 0.03],
      fontSize: 14,
      confidence: 0.93,
    },
  ];
}

async function detectLayoutRegions(
  job: MediaPreprocessJob,
  textBlocks: OcrBlock[],
  provider: string
): Promise<LayoutRegion[]> {
  console.log('[164.3][LAYOUT] Detecting UI regions');

  // TODO: Use LLM Vision to detect layout regions
  // For now, return mock layout based on common dashboard patterns

  return [
    {
      id: generateId('region'),
      type: 'navbar',
      bbox: [0, 0, 1, 0.08],
      label: 'Top Navigation',
      hasBorder: true,
      hasBackground: true,
    },
    {
      id: generateId('region'),
      type: 'sidebar',
      bbox: [0, 0.08, 0.18, 0.92],
      label: 'Side Navigation',
      hasBackground: true,
    },
    {
      id: generateId('region'),
      type: 'header',
      bbox: [0.18, 0.08, 0.82, 0.08],
      label: 'Page Header',
    },
    {
      id: generateId('region'),
      type: 'card',
      bbox: [0.02, 0.12, 0.25, 0.18],
      label: 'Users Stats Card',
      hasBorder: true,
      hasBackground: true,
    },
    {
      id: generateId('region'),
      type: 'card',
      bbox: [0.28, 0.12, 0.25, 0.18],
      label: 'Revenue Stats Card',
      hasBorder: true,
      hasBackground: true,
    },
    {
      id: generateId('region'),
      type: 'card',
      bbox: [0.54, 0.12, 0.25, 0.18],
      label: 'Sessions Stats Card',
      hasBorder: true,
      hasBackground: true,
    },
    {
      id: generateId('region'),
      type: 'chart',
      bbox: [0.02, 0.32, 0.55, 0.35],
      label: 'Main Chart Area',
      hasBorder: true,
    },
    {
      id: generateId('region'),
      type: 'list',
      bbox: [0.58, 0.32, 0.40, 0.35],
      label: 'Activity List',
      hasBorder: true,
    },
    {
      id: generateId('region'),
      type: 'table',
      bbox: [0.02, 0.70, 0.96, 0.28],
      label: 'Data Table',
      hasBorder: true,
    },
  ];
}

async function extractStylePalette(
  job: MediaPreprocessJob,
  provider: string
): Promise<StylePalette> {
  console.log('[164.3][STYLE] Extracting style palette');

  // TODO: Analyze image colors and detect design patterns
  // For now, return a mock palette

  return {
    primary: '#6366f1',      // Indigo
    secondary: '#8b5cf6',    // Purple
    accents: ['#10b981', '#f59e0b', '#ef4444'],
    background: '#0f172a',   // Dark slate
    textColor: '#f8fafc',    // Light text
    borderRadiusHint: 'lg',
    shadowLevelHint: 2,
    spacingHint: 'normal',
    fontFamilyHint: 'sans',
    colorHistogram: [
      { color: '#0f172a', percentage: 45 },
      { color: '#1e293b', percentage: 25 },
      { color: '#6366f1', percentage: 12 },
      { color: '#f8fafc', percentage: 10 },
      { color: '#10b981', percentage: 8 },
    ],
  };
}

async function extractEntities(
  textBlocks: OcrBlock[],
  layoutRegions: LayoutRegion[],
  provider: string
): Promise<MediaEntity[]> {
  console.log('[164.3][ENTITIES] Extracting entities');

  // Extract entities from text blocks
  const entities: MediaEntity[] = [];

  for (const block of textBlocks) {
    // Detect numbers/metrics
    const numMatch = block.text.match(/^[\$€£]?[\d,]+\.?\d*$/);
    if (numMatch) {
      entities.push({
        id: generateId('entity'),
        type: 'metric',
        name: 'value',
        value: block.text,
        sourceBlockId: block.id,
      });
    }

    // Detect labels (short text without numbers)
    if (block.text.length < 30 && !/\d/.test(block.text)) {
      entities.push({
        id: generateId('entity'),
        type: 'label',
        name: block.text,
        sourceBlockId: block.id,
      });
    }
  }

  // Add component entities from layout regions
  for (const region of layoutRegions) {
    if (region.label) {
      entities.push({
        id: generateId('entity'),
        type: 'component',
        name: region.label,
        description: `${region.type} component`,
        sourceRegionId: region.id,
      });
    }
  }

  return entities;
}

async function generateImageSummary(
  textBlocks: OcrBlock[],
  layoutRegions: LayoutRegion[],
  entities: MediaEntity[],
  provider: string
): Promise<string> {
  console.log('[164.3][SUMMARY] Generating image summary');

  const regionTypes = layoutRegions.map(r => r.type);
  const hasNavbar = regionTypes.includes('navbar');
  const hasSidebar = regionTypes.includes('sidebar');
  const hasCards = regionTypes.includes('card');
  const hasChart = regionTypes.includes('chart');
  const hasTable = regionTypes.includes('table');

  const components: string[] = [];
  if (hasNavbar) components.push('navigation bar');
  if (hasSidebar) components.push('sidebar');
  if (hasCards) components.push('stat cards');
  if (hasChart) components.push('chart');
  if (hasTable) components.push('data table');

  const metricCount = entities.filter(e => e.type === 'metric').length;

  return `Dashboard UI with ${components.join(', ')}. Contains ${layoutRegions.length} distinct regions and ${textBlocks.length} text elements. Detected ${metricCount} metrics/KPIs. Design uses dark theme with rounded corners and subtle shadows.`;
}

// =============================================================================
// 164.4 – PDF Pipeline
// =============================================================================

async function runPdfPipeline(
  job: MediaPreprocessJob,
  provider: string
): Promise<MediaPreprocessResult> {
  console.log('[164.4][PDF] Running PDF pipeline');

  // Mock PDF processing
  const pdfMeta: PdfMeta = {
    pageCount: 3,
    title: 'Product Requirements Document',
    author: 'F0 Team',
    creationDate: new Date().toISOString(),
    isScanned: false,
  };

  const pdfPages: PdfPage[] = [
    {
      index: 0,
      width: 612,
      height: 792,
      textBlocks: [
        {
          id: generateId('ocr'),
          text: 'Product Requirements Document',
          bbox: [0.1, 0.05, 0.8, 0.05],
          fontSize: 24,
          fontWeight: 'bold',
          pageIndex: 0,
        },
        {
          id: generateId('ocr'),
          text: 'Overview',
          bbox: [0.1, 0.15, 0.3, 0.03],
          fontSize: 18,
          fontWeight: 'bold',
          pageIndex: 0,
        },
        {
          id: generateId('ocr'),
          text: 'This document outlines the requirements for the new dashboard feature.',
          bbox: [0.1, 0.20, 0.8, 0.05],
          fontSize: 12,
          pageIndex: 0,
        },
      ],
      layoutRegions: [
        {
          id: generateId('region'),
          type: 'header',
          bbox: [0.1, 0.05, 0.8, 0.08],
          pageIndex: 0,
        },
        {
          id: generateId('region'),
          type: 'section',
          bbox: [0.1, 0.15, 0.8, 0.15],
          label: 'Overview Section',
          pageIndex: 0,
        },
      ],
    },
  ];

  // Flatten text blocks and regions from all pages
  const textBlocks: OcrBlock[] = pdfPages.flatMap(p => p.textBlocks);
  const layoutRegions: LayoutRegion[] = pdfPages.flatMap(p => p.layoutRegions);

  // Extract entities
  const entities: MediaEntity[] = [
    {
      id: generateId('entity'),
      type: 'requirement',
      name: 'Dashboard Feature',
      description: 'New dashboard with analytics',
    },
    {
      id: generateId('entity'),
      type: 'feature',
      name: 'Real-time Charts',
      description: 'Display live data updates',
    },
    {
      id: generateId('entity'),
      type: 'component',
      name: 'Stats Cards',
      description: 'KPI display components',
    },
  ];

  const summary = `PDF document with ${pdfMeta.pageCount} pages. Title: "${pdfMeta.title}". Contains product requirements including dashboard features, real-time charts, and stats components. Document has ${textBlocks.length} text blocks and ${layoutRegions.length} sections.`;

  return {
    id: job.id,
    projectId: job.projectId,
    attachmentId: job.attachmentId,
    kind: 'pdf',
    summary,
    textBlocks,
    layoutRegions,
    style: null,
    entities,
    pdfPages,
    pdfMeta,
    createdAt: Date.now(),
  };
}

// =============================================================================
// 164.5 – Audio Pipeline (ASR + Diarization)
// =============================================================================

async function runAudioPipeline(
  job: MediaPreprocessJob,
  provider: string
): Promise<MediaPreprocessResult> {
  console.log('[164.5][AUDIO] Running audio pipeline');

  // Mock audio processing
  const audioMeta: AudioMeta = {
    durationSec: 180,
    sampleRate: 44100,
    channels: 1,
    speakerCount: 2,
    languageCode: 'en-US',
  };

  const audioSegments: AudioSegment[] = [
    {
      id: generateId('seg'),
      startSec: 0,
      endSec: 15,
      speakerTag: 'SPEAKER_1',
      speakerName: 'Product Manager',
      text: 'Okay, let\'s discuss the new dashboard requirements. We need three main KPI cards at the top.',
      isInstruction: true,
      entities: [
        { id: generateId('entity'), type: 'component', name: 'KPI Cards' },
      ],
    },
    {
      id: generateId('seg'),
      startSec: 16,
      endSec: 30,
      speakerTag: 'SPEAKER_2',
      speakerName: 'Developer',
      text: 'Should the cards show real-time data or is cached data acceptable?',
      isQuestion: true,
    },
    {
      id: generateId('seg'),
      startSec: 31,
      endSec: 45,
      speakerTag: 'SPEAKER_1',
      speakerName: 'Product Manager',
      text: 'Real-time would be ideal, but we can start with 5-minute refresh intervals.',
      isDecision: true,
      entities: [
        { id: generateId('entity'), type: 'requirement', name: '5-minute refresh' },
      ],
    },
    {
      id: generateId('seg'),
      startSec: 46,
      endSec: 65,
      speakerTag: 'SPEAKER_1',
      speakerName: 'Product Manager',
      text: 'We also need a main chart showing user activity over time, and a table with recent transactions.',
      isInstruction: true,
      entities: [
        { id: generateId('entity'), type: 'component', name: 'Activity Chart' },
        { id: generateId('entity'), type: 'component', name: 'Transactions Table' },
      ],
    },
  ];

  // Extract all entities from segments
  const entities: MediaEntity[] = audioSegments
    .flatMap(seg => seg.entities || [])
    .filter((e, i, arr) => arr.findIndex(x => x.name === e.name) === i);

  // Generate transcript for text blocks
  const textBlocks: OcrBlock[] = audioSegments.map(seg => ({
    id: seg.id,
    text: seg.text,
    bbox: [0, seg.startSec / audioMeta.durationSec, 1, (seg.endSec - seg.startSec) / audioMeta.durationSec],
    confidence: seg.confidence || 0.95,
  }));

  const summary = `Audio recording (${Math.floor(audioMeta.durationSec / 60)}:${String(audioMeta.durationSec % 60).padStart(2, '0')} duration) with ${audioMeta.speakerCount} speakers. Discussion covers dashboard requirements including KPI cards, activity charts, and transactions table. Key decisions: 5-minute refresh intervals for data. Contains ${audioSegments.filter(s => s.isQuestion).length} questions and ${audioSegments.filter(s => s.isInstruction).length} instructions.`;

  return {
    id: job.id,
    projectId: job.projectId,
    attachmentId: job.attachmentId,
    kind: 'audio',
    summary,
    textBlocks,
    layoutRegions: [],
    style: null,
    entities,
    audioSegments,
    audioMeta,
    createdAt: Date.now(),
  };
}

// =============================================================================
// Export module index
// =============================================================================

export { MediaPreprocessEngineOptions };

console.log('[164][MEDIA_PREPROCESS] Engine module loaded');
