// orchestrator/core/media/types.ts
// =============================================================================
// Phase 160.1 – Media Agent Types (v1.1 - Hardened)
// Types for image/PDF/document understanding
// Phase 160.1.1: Added per-analysisType statuses and idempotency
// =============================================================================

/**
 * Type of media analysis to perform
 */
export type MediaAnalysisType =
  | 'describe'      // Describe image contents
  | 'ocr'           // Extract text from image
  | 'extract_text'  // Extract text from PDF/doc
  | 'summarize'     // Summarize document
  | 'embed';        // Generate embeddings for RAG

/**
 * Phase 160.1.1: Per-analysis status (not just job status)
 */
export type MediaAnalysisStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'SKIPPED';

/**
 * Phase 160.1.1: Bus message for requesting analysis
 */
export interface MediaAnalyzeRequestMsg {
  kind: 'MEDIA_ANALYZE_REQUEST';
  attachmentId: string;
  projectId: string;
  analysisType: MediaAnalysisType;
  locale?: 'ar' | 'en';
  options?: {
    language?: string;
    maxLength?: number;
    embedModel?: string;
  };
  /** Idempotency key to prevent duplicate processing: `${attachmentId}:${analysisType}:${hash}` */
  analysisKey?: string;
}

/**
 * Phase 160.1.1: Bus message for analysis result
 */
export interface MediaAnalyzeResultMsg {
  kind: 'MEDIA_ANALYZE_RESULT';
  attachmentId: string;
  projectId: string;
  analysisType: MediaAnalysisType;
  success: boolean;
  result?: {
    text?: string;           // ocr / extract_text (raw)
    description?: string;    // describe
    summary?: string;        // summarize
    embeddingsRef?: string;  // embed (reference to vector store, not inline)
    pageCount?: number;
    language?: string;
    metadata?: Record<string, unknown>;
  };
  error?: string;
  processingTimeMs?: number;
  provider?: string;  // 'mock' | 'gemini' | 'openai' | 'claude'
}

/**
 * Input for media analysis request
 */
export interface MediaAnalysisInput {
  attachmentId: string;
  projectId: string;
  analysisType: MediaAnalysisType;
  locale?: 'ar' | 'en';
  options?: {
    language?: string;        // Target language for extraction
    maxLength?: number;       // Max chars for summary
    embedModel?: string;      // Embedding model to use
    includeConfidence?: boolean;
    format?: 'plain' | 'markdown' | 'json';
  };
  /** Idempotency key */
  analysisKey?: string;
}

/**
 * Output from media analysis
 */
export interface MediaAnalysisOutput {
  attachmentId: string;
  analysisType: MediaAnalysisType;
  success: boolean;
  result?: {
    text?: string;           // Extracted/OCR text (raw)
    description?: string;    // Image description
    summary?: string;        // Document summary
    embeddings?: number[];   // Vector embeddings (inline for small)
    embeddingsRef?: string;  // Reference to vector store (for large)
    confidence?: number;     // 0-1 confidence score
    language?: string;       // Detected language
    pageCount?: number;      // For multi-page docs
    wordCount?: number;      // Word count
    metadata?: Record<string, unknown>;
  };
  error?: string;
  processingTimeMs?: number;
  provider?: string;  // 'mock' | 'gemini' | 'openai' | 'claude'
}

/**
 * Phase 160.1.1: Queue item for processing
 */
export interface MediaQueueItem {
  id: string;
  attachmentId: string;
  projectId: string;
  /** Multiple analysis types can be requested in batch */
  requested: MediaAnalysisType[];
  locale?: 'ar' | 'en';
  priority?: number;
  attempts?: number;
  maxAttempts?: number;
  createdAt: string;
  /** Idempotency key for deduplication */
  analysisKey?: string;
}

/**
 * Media processing job status (legacy - use MediaAnalysisStatus for per-type)
 */
export type MediaJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

/**
 * Media processing job
 */
export interface MediaJob {
  id: string;
  attachmentId: string;
  projectId: string;
  analysisType: MediaAnalysisType;
  status: MediaJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: MediaAnalysisOutput;
  error?: string;
  retryCount?: number;
}

/**
 * Phase 160.1.1: Per-analysis type status record
 * Stored on attachment document for granular tracking
 */
export interface AnalysisTypeRecord {
  status: MediaAnalysisStatus;
  ts?: string;
  provider?: string;
  /** Raw extracted content (before formatting) */
  text?: string;
  description?: string;
  summary?: string;
  embeddingsRef?: string;
  pageCount?: number;
  error?: string;
}

/**
 * Phase 160.1.1: Attachment media analysis storage
 * This is what gets stored on the attachment document
 */
export interface AttachmentMediaAnalysis {
  describe?: AnalysisTypeRecord;
  ocr?: AnalysisTypeRecord;
  extract_text?: AnalysisTypeRecord;
  summarize?: AnalysisTypeRecord;
  embed?: AnalysisTypeRecord & {
    model?: string;
    dims?: number;
  };
  lastError?: string;
  /** Formatted message for chat display (separate from raw extraction) */
  formattedForChat?: {
    locale: 'ar' | 'en';
    message: string;
    ts: string;
  };
}

/**
 * Configuration for MediaAgent
 */
export interface MediaAgentConfig {
  pollIntervalMs?: number;      // Queue poll interval (default: 5000)
  maxRetries?: number;          // Max retries per job (default: 3)
  timeoutMs?: number;           // Job timeout (default: 60000)
  enableAutoProcessing?: boolean; // Auto-process new attachments
  /** Phase 160.1.1: Concurrency limit */
  concurrency?: number;         // Max concurrent jobs (default: 1)
  /** Phase 160.1.1: Backoff settings */
  backoffBase?: number;         // Base backoff ms (default: 1000)
  backoffMax?: number;          // Max backoff ms (default: 30000)
}

/**
 * Supported MIME types for each analysis type
 */
export const SUPPORTED_ANALYSIS: Record<MediaAnalysisType, string[]> = {
  describe: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
  ],
  ocr: [
    'image/png',
    'image/jpeg',
    'image/webp',
  ],
  extract_text: [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  summarize: [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  embed: [
    'image/png',
    'image/jpeg',
    'application/pdf',
    'text/plain',
    'text/markdown',
  ],
};

/**
 * Check if analysis type is supported for a MIME type
 */
export function isAnalysisSupported(
  analysisType: MediaAnalysisType,
  mimeType: string
): boolean {
  const supported = SUPPORTED_ANALYSIS[analysisType] || [];
  return supported.includes(mimeType);
}

console.log('[160.1][MEDIA] Types loaded');
