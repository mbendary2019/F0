// orchestrator/core/media/index.ts
// Phase 171: Media Agent - Main exports

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type {
  // Core types
  MediaType,
  AnalysisIntent,
  VisionProvider,
  VisionModelId,

  // Input/Output
  MediaInput,
  MediaAnalysisRequest,
  MediaAnalysisResponse,
  ExtractedContent,
  AnalysisResult,

  // Structured data
  UIComponent,
  CodeBlock,
  DataPoint,

  // Metrics and config
  MediaProcessingMetrics,
  VisionModelConfig,
  VisionRoutingContext,
  VisionRoutingResult,
} from './mediaTypes';

// ═══════════════════════════════════════════════════════════════
// Vision Router
// ═══════════════════════════════════════════════════════════════

export {
  VisionRouter,
  routeVision,
  getVisionModelConfig,
  VISION_MODELS,
} from './visionRouter';

// ═══════════════════════════════════════════════════════════════
// Media Agent
// ═══════════════════════════════════════════════════════════════

export {
  MediaAgent,
  getMediaAgent,
  analyzeMedia,
  analyzeImage,
  analyzePDF,
  analyzeImageUrl,
} from './mediaAgent';

// ═══════════════════════════════════════════════════════════════
// Extractors
// ═══════════════════════════════════════════════════════════════

export {
  // Image extractor
  validateImage,
  extractBase64,
  prepareImageForVision,
  detectMediaType,
  formatImageForProvider,
  urlToBase64,
  extractImageContent,
  resizeImageIfNeeded,
  SUPPORTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  type ImageValidationResult,
  type ImageMetadata,
} from './extractors/imageExtractor';

export {
  // PDF extractor
  validatePDF,
  extractPDFContent,
  extractPDFPages,
  getPDFMetadata,
  isScannedPDF,
  chunkPDFText,
  MAX_PDF_SIZE_BYTES,
  type PDFValidationResult,
  type PDFExtractionOptions,
} from './extractors/pdfExtractor';

// ═══════════════════════════════════════════════════════════════
// Prompts
// ═══════════════════════════════════════════════════════════════

export {
  getVisionSystemPrompt,
  buildUserPrompt,
  getResponseFormatInstructions,
} from './prompts/visionAnalysisPrompt';

export {
  UI_EXTRACTION_SYSTEM_PROMPT,
  COMPONENT_EXTRACTION_PROMPT,
  LAYOUT_ANALYSIS_PROMPT,
  DESIGN_TOKENS_PROMPT,
  REACT_COMPONENT_PROMPT,
  ACCESSIBILITY_UI_PROMPT,
  getUIExtractionPrompt,
} from './prompts/uiExtractionPrompt';
