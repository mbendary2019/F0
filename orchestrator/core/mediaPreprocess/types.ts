// orchestrator/core/mediaPreprocess/types.ts
// =============================================================================
// Phase 164.0 – Media Pre-Processing Pipeline Types
// Unified data model for image/PDF/audio preprocessing
// =============================================================================

export type MediaKind = 'image' | 'pdf' | 'audio';

export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';

// =============================================================================
// Job Management
// =============================================================================

export interface MediaPreprocessJob {
  id: string;
  projectId: string;
  attachmentId: string;
  kind: MediaKind;
  status: JobStatus;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;

  // Optional metadata
  attachmentUrl?: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
}

// =============================================================================
// OCR (Optical Character Recognition)
// =============================================================================

export interface OcrBlock {
  id: string;
  text: string;
  bbox: [number, number, number, number]; // [x, y, w, h] normalized 0–1
  language?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  confidence?: number;
  pageIndex?: number; // For multi-page PDFs
}

// =============================================================================
// Layout Detection
// =============================================================================

export type LayoutRegionType =
  | 'header'
  | 'navbar'
  | 'sidebar'
  | 'footer'
  | 'card'
  | 'form'
  | 'table'
  | 'grid'
  | 'hero'
  | 'modal'
  | 'button'
  | 'input'
  | 'image'
  | 'chart'
  | 'list'
  | 'section'
  | 'unknown';

export interface LayoutRegion {
  id: string;
  type: LayoutRegionType;
  bbox: [number, number, number, number]; // [x, y, w, h] normalized 0–1
  label?: string; // e.g., "Login Form", "User Stats Card"
  childrenOcrBlockIds?: string[];
  childrenRegionIds?: string[];
  pageIndex?: number;

  // Visual hints
  hasIcon?: boolean;
  hasBorder?: boolean;
  hasBackground?: boolean;
}

// =============================================================================
// Style Extraction
// =============================================================================

export interface StylePalette {
  primary: string | null;      // Main brand color
  secondary: string | null;    // Secondary color
  accents: string[];           // Accent/highlight colors
  background: string | null;   // Background color
  textColor: string | null;    // Primary text color

  // Design hints
  borderRadiusHint?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  shadowLevelHint?: 0 | 1 | 2 | 3;
  spacingHint?: 'tight' | 'normal' | 'roomy';
  fontFamilyHint?: 'sans' | 'serif' | 'mono';

  // Detected colors with frequency
  colorHistogram?: Array<{ color: string; percentage: number }>;
}

// =============================================================================
// Entity Extraction
// =============================================================================

export type EntityType =
  | 'number'
  | 'date'
  | 'user'
  | 'metric'
  | 'action'
  | 'label'
  | 'requirement'
  | 'feature'
  | 'component'
  | 'page'
  | 'api'
  | 'status';

export interface MediaEntity {
  id: string;
  type: EntityType;
  name: string;
  value?: string;
  description?: string;
  sourceBlockId?: string; // Links to OcrBlock.id
  sourceRegionId?: string; // Links to LayoutRegion.id
  confidence?: number;
}

// =============================================================================
// Audio-Specific Types
// =============================================================================

export interface AudioSegment {
  id: string;
  startSec: number;
  endSec: number;
  speakerTag?: string;
  speakerName?: string;
  text: string;
  language?: string;
  confidence?: number;

  // Semantic flags
  isQuestion?: boolean;
  isInstruction?: boolean;
  isRequirement?: boolean;
  isDecision?: boolean;

  // Extracted entities
  entities?: MediaEntity[];
}

export interface AudioMeta {
  durationSec: number;
  sampleRate?: number;
  channels?: number;
  speakerCount?: number;
  languageCode?: string;
}

// =============================================================================
// PDF-Specific Types
// =============================================================================

export interface PdfPage {
  index: number;
  width: number;
  height: number;
  textBlocks: OcrBlock[];
  layoutRegions: LayoutRegion[];
}

export interface PdfMeta {
  pageCount: number;
  title?: string;
  author?: string;
  creationDate?: string;
  isScanned?: boolean; // If true, OCR was needed
}

// =============================================================================
// Final Result
// =============================================================================

export interface MediaPreprocessResult {
  id: string; // Same as jobId
  projectId: string;
  attachmentId: string;
  kind: MediaKind;

  // Universal fields
  summary: string;
  textBlocks: OcrBlock[];
  layoutRegions: LayoutRegion[];
  style: StylePalette | null;
  entities: MediaEntity[];

  // Audio-specific
  audioSegments?: AudioSegment[];
  audioMeta?: AudioMeta;

  // PDF-specific
  pdfPages?: PdfPage[];
  pdfMeta?: PdfMeta;

  // Provider metadata
  rawProviderMeta?: Record<string, unknown>;
  provider?: 'vision-api' | 'whisper' | 'gemini' | 'tesseract' | 'mock';

  // Timestamps
  createdAt: number;
  processingTimeMs?: number;
}

// =============================================================================
// Store Interface
// =============================================================================

export interface MediaPreprocessStore {
  // Job operations
  createJob(job: Omit<MediaPreprocessJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<MediaPreprocessJob>;
  getJob(jobId: string): Promise<MediaPreprocessJob | null>;
  updateJobStatus(jobId: string, status: JobStatus, errorMessage?: string): Promise<void>;
  listJobs(projectId: string, limit?: number): Promise<MediaPreprocessJob[]>;

  // Result operations
  saveResult(result: MediaPreprocessResult): Promise<void>;
  getResult(jobId: string): Promise<MediaPreprocessResult | null>;
  getResultByAttachment(projectId: string, attachmentId: string): Promise<MediaPreprocessResult | null>;
  listResults(projectId: string, kind?: MediaKind): Promise<MediaPreprocessResult[]>;

  // Cleanup
  deleteJob(jobId: string): Promise<void>;
  deleteResult(jobId: string): Promise<void>;
}

console.log('[164.0][MEDIA_PREPROCESS] Types loaded');
