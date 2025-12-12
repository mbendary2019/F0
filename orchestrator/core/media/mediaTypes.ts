// orchestrator/core/media/mediaTypes.ts
// Phase 171: Media Agent - Types and Interfaces

/**
 * Supported media types for analysis
 */
export type MediaType = 'image' | 'pdf' | 'video_frame' | 'screenshot';

/**
 * Analysis intent - what the user wants to extract
 */
export type AnalysisIntent =
  | 'general_description'    // What's in this image/PDF?
  | 'ui_extraction'          // Extract UI components/layout
  | 'code_extraction'        // Extract code from screenshot
  | 'document_summary'       // Summarize document content
  | 'data_extraction'        // Extract tables/charts/data
  | 'error_analysis'         // Analyze error screenshots
  | 'design_feedback'        // Provide design critique
  | 'accessibility_audit';   // Check accessibility issues

/**
 * Vision model providers
 */
export type VisionProvider = 'anthropic' | 'openai' | 'gemini';

/**
 * Vision model identifiers
 */
export type VisionModelId =
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-haiku-20240307'
  | 'claude-sonnet-4-20250514'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro';

/**
 * Input for media analysis
 */
export interface MediaInput {
  /** Base64 encoded content or URL */
  content: string;
  /** Content type */
  contentType: 'base64' | 'url' | 'file_path';
  /** MIME type (image/png, application/pdf, etc.) */
  mimeType: string;
  /** Original filename if available */
  filename?: string;
  /** File size in bytes */
  sizeBytes?: number;
}

/**
 * Request for media analysis
 */
export interface MediaAnalysisRequest {
  /** Media input */
  media: MediaInput;
  /** Analysis intent */
  intent: AnalysisIntent;
  /** User's question/prompt about the media */
  userPrompt?: string;
  /** Project context for better analysis */
  projectContext?: {
    projectId: string;
    techStack?: string[];
    designSystem?: string;
  };
  /** User tier for model selection */
  userTier?: 'free' | 'pro' | 'enterprise';
  /** Force specific model */
  forceModel?: VisionModelId;
  /** Max tokens for response */
  maxTokens?: number;
}

/**
 * Extracted content from media
 */
export interface ExtractedContent {
  /** Raw text content (from PDFs, OCR) */
  text?: string;
  /** Detected language */
  language?: string;
  /** Page count for PDFs */
  pageCount?: number;
  /** Image dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Structured analysis result
 */
export interface AnalysisResult {
  /** Main description/summary */
  description: string;
  /** Key findings */
  findings: string[];
  /** Extracted UI components (for ui_extraction) */
  uiComponents?: UIComponent[];
  /** Extracted code (for code_extraction) */
  codeBlocks?: CodeBlock[];
  /** Extracted data (for data_extraction) */
  dataPoints?: DataPoint[];
  /** Suggestions/recommendations */
  suggestions?: string[];
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * UI Component extracted from screenshot
 */
export interface UIComponent {
  type: 'button' | 'input' | 'card' | 'nav' | 'header' | 'footer' | 'modal' | 'list' | 'table' | 'form' | 'other';
  name?: string;
  description: string;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  styles?: {
    colors?: string[];
    typography?: string;
    spacing?: string;
  };
  children?: UIComponent[];
}

/**
 * Code block extracted from screenshot
 */
export interface CodeBlock {
  language: string;
  code: string;
  startLine?: number;
  endLine?: number;
  filename?: string;
  confidence: number;
}

/**
 * Data point extracted from charts/tables
 */
export interface DataPoint {
  label: string;
  value: string | number;
  unit?: string;
  source?: string;
}

/**
 * Full response from media analysis
 */
export interface MediaAnalysisResponse {
  /** Success status */
  success: boolean;
  /** Detected media type */
  mediaType: MediaType;
  /** Analysis intent used */
  intent: AnalysisIntent;
  /** Extracted raw content */
  extracted?: ExtractedContent;
  /** Structured analysis */
  analysis: AnalysisResult;
  /** Model used for analysis */
  modelUsed: VisionModelId;
  /** Provider used */
  providerUsed: VisionProvider;
  /** Processing metrics */
  metrics: MediaProcessingMetrics;
  /** Error message if failed */
  error?: string;
}

/**
 * Processing metrics for observability
 */
export interface MediaProcessingMetrics {
  /** Total processing time in ms */
  totalLatencyMs: number;
  /** Extraction time (PDF parsing, etc.) */
  extractionLatencyMs?: number;
  /** Vision API call time */
  visionLatencyMs: number;
  /** Token usage */
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  /** Estimated cost in USD */
  estimatedCostUsd: number;
  /** Retry count if any */
  retryCount: number;
}

/**
 * Vision model configuration
 */
export interface VisionModelConfig {
  modelId: VisionModelId;
  provider: VisionProvider;
  maxImageSize: number; // bytes
  maxTokens: number;
  supportedFormats: string[];
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  supportsMultipleImages: boolean;
  supportsPdf: boolean;
}

/**
 * Vision routing context
 */
export interface VisionRoutingContext {
  mediaType: MediaType;
  intent: AnalysisIntent;
  userTier: 'free' | 'pro' | 'enterprise';
  fileSizeBytes?: number;
  isUrgent?: boolean;
}

/**
 * Vision routing result
 */
export interface VisionRoutingResult {
  primaryModel: VisionModelId;
  provider: VisionProvider;
  fallbacks: VisionModelId[];
  reason: string;
}
