// orchestrator/agents/mediaAgent.ts
// =============================================================================
// Phase 160.1 – Media Agent (v1.1 - Hardened)
// AI-powered image/PDF/document understanding agent
// Phase 160.1.1: Added backoff loop, idempotency, per-analysisType status
// =============================================================================

import type { AgentBus, AgentMessage, AgentContextHandle } from '../core/multiAgent/types';
import type {
  MediaAnalysisInput,
  MediaAnalysisOutput,
  MediaAgentConfig,
  MediaAnalysisType,
  MediaAnalysisStatus,
  MediaQueueItem,
  AnalysisTypeRecord,
  AttachmentMediaAnalysis,
  MediaAnalyzeRequestMsg,
  MediaAnalyzeResultMsg,
} from '../core/media/types';
import { isAnalysisSupported } from '../core/media/types';
import {
  getNextProcessingItem,
  getAttachmentForProcessing,
  markAttachmentProcessing,
  markAttachmentReady,
  markAttachmentError,
  type AttachmentProcessingRequest,
} from '../core/attachments/mediaAgentHooks';

// =============================================================================
// Phase 160.1.1: Idempotency tracking (in-memory, replace with Redis/Firestore in prod)
// =============================================================================
const processedKeys = new Set<string>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateAnalysisKey(attachmentId: string, analysisType: MediaAnalysisType): string {
  return `${attachmentId}:${analysisType}:${Date.now()}`;
}

function isAlreadyProcessed(analysisKey: string): boolean {
  return processedKeys.has(analysisKey);
}

function markAsProcessed(analysisKey: string): void {
  processedKeys.add(analysisKey);
  // Auto-cleanup after TTL
  setTimeout(() => {
    processedKeys.delete(analysisKey);
  }, IDEMPOTENCY_TTL_MS);
}

// =============================================================================
// MediaAgent Class (v1.1 - Hardened)
// =============================================================================

export class MediaAgent {
  private bus: AgentBus;
  private config: Required<MediaAgentConfig>;
  private running = false;
  // Phase 160.1.1: Remove setInterval, use async loop with backoff
  private currentBackoff = 0;
  private processingCount = 0;

  constructor(options: { bus: AgentBus; config?: MediaAgentConfig }) {
    this.bus = options.bus;
    this.config = {
      pollIntervalMs: options.config?.pollIntervalMs ?? 5000,
      maxRetries: options.config?.maxRetries ?? 3,
      timeoutMs: options.config?.timeoutMs ?? 60000,
      enableAutoProcessing: options.config?.enableAutoProcessing ?? true,
      // Phase 160.1.1: New config options
      concurrency: options.config?.concurrency ?? 1,
      backoffBase: options.config?.backoffBase ?? 1000,
      backoffMax: options.config?.backoffMax ?? 30000,
    };

    this.subscribeToMessages();

    if (this.config.enableAutoProcessing) {
      this.startProcessingLoop();
    }

    console.log('[160.1.1][MEDIA_AGENT] Initialized with hardened processing');
  }

  // ===========================================================================
  // Message Subscription
  // ===========================================================================

  private subscribeToMessages() {
    this.bus.subscribe('media', async (message: AgentMessage) => {
      console.log('[160.1][MEDIA_AGENT] Received message:', message.kind);

      switch (message.kind) {
        case 'TASK_ASSIGNMENT':
          await this.handleTaskAssignment(message);
          break;
        case 'INFO_REQUEST':
          await this.handleInfoRequest(message);
          break;
        default:
          console.log('[160.1][MEDIA_AGENT] Unhandled message kind:', message.kind);
      }
    });
  }

  // ===========================================================================
  // Task Handling
  // ===========================================================================

  private async handleTaskAssignment(message: AgentMessage) {
    const payload = message.payload as {
      attachmentId: string;
      analysisType: MediaAnalysisType;
      options?: Record<string, unknown>;
    };

    console.log('[160.1][MEDIA_AGENT] Task assignment:', payload.attachmentId);

    const input: MediaAnalysisInput = {
      attachmentId: payload.attachmentId,
      projectId: message.context.projectId,
      analysisType: payload.analysisType,
      options: payload.options,
    };

    try {
      const result = await this.analyze(input);

      // Publish result back
      await this.bus.publish({
        id: `media-result-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: 'media',
        to: message.from,
        kind: 'TASK_RESULT',
        context: message.context,
        safety: { level: 'low' },
        payload: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.bus.publish({
        id: `media-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: 'media',
        to: message.from,
        kind: 'TASK_ERROR',
        context: message.context,
        safety: { level: 'low' },
        payload: {
          attachmentId: payload.attachmentId,
          error: errorMessage,
        },
      });
    }
  }

  private async handleInfoRequest(message: AgentMessage) {
    // Handle capability queries
    const payload = message.payload as { query?: string };

    if (payload.query === 'capabilities') {
      await this.bus.publish({
        id: `media-info-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: 'media',
        to: message.from,
        kind: 'INFO_RESPONSE',
        context: message.context,
        safety: { level: 'low' },
        payload: {
          capabilities: ['describe', 'ocr', 'extract_text', 'summarize', 'embed'],
          supportedTypes: ['image/png', 'image/jpeg', 'application/pdf', 'text/plain'],
        },
      });
    }
  }

  // ===========================================================================
  // Processing Queue Loop (Phase 160.1.1: Backoff-based instead of setInterval)
  // ===========================================================================

  private async startProcessingLoop() {
    this.running = true;
    this.currentBackoff = 0;
    console.log('[160.1.1][MEDIA_AGENT] Starting backoff processing loop');

    // Async loop with exponential backoff when queue is empty
    while (this.running) {
      try {
        const processed = await this.processNextQueueItem();

        if (processed) {
          // Reset backoff on successful processing
          this.currentBackoff = 0;
        } else {
          // Increase backoff when queue is empty
          this.currentBackoff = Math.min(
            this.currentBackoff === 0
              ? this.config.backoffBase
              : this.currentBackoff * 2,
            this.config.backoffMax
          );
        }

        // Wait before next poll
        const waitTime = processed ? 100 : this.currentBackoff;
        await this.sleep(waitTime);
      } catch (error) {
        console.error('[160.1.1][MEDIA_AGENT] Loop error:', error);
        // On error, use base backoff
        this.currentBackoff = this.config.backoffBase;
        await this.sleep(this.currentBackoff);
      }
    }

    console.log('[160.1.1][MEDIA_AGENT] Processing loop stopped');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Phase 160.1.1: Process next queue item with idempotency check
   * Returns true if an item was processed, false if queue was empty
   */
  private async processNextQueueItem(): Promise<boolean> {
    // Check concurrency limit
    if (this.processingCount >= this.config.concurrency) {
      return false;
    }

    const item = getNextProcessingItem();
    if (!item) return false;

    // Phase 160.1.1: Generate idempotency key
    const analysisType = this.mapProcessType(item.processType);
    const analysisKey = `${item.attachmentId}:${analysisType}`;

    // Check if already processed (idempotency)
    if (isAlreadyProcessed(analysisKey)) {
      console.log('[160.1.1][MEDIA_AGENT] Skipping duplicate:', analysisKey);
      return true; // Return true to not trigger backoff
    }

    console.log('[160.1.1][MEDIA_AGENT] Processing queue item:', item.attachmentId);
    this.processingCount++;

    await markAttachmentProcessing(item.attachmentId);

    try {
      const attachment = await getAttachmentForProcessing(item.attachmentId);
      if (!attachment) {
        throw new Error('Attachment not found');
      }

      const input: MediaAnalysisInput = {
        attachmentId: item.attachmentId,
        projectId: item.projectId,
        analysisType,
        analysisKey,
      };

      const result = await this.analyze(input);

      if (result.success && result.result) {
        // Phase 160.1.1: Mark as processed for idempotency
        markAsProcessed(analysisKey);

        await markAttachmentReady(item.attachmentId, {
          analysis: result.result,
          analysisType: result.analysisType,
          processedAt: new Date().toISOString(),
          provider: result.provider,
        });

        // Phase 160.1.1: Publish result to bus
        await this.publishAnalysisResult(item, result, true);
      } else {
        await markAttachmentError(item.attachmentId, result.error || 'Analysis failed');
        await this.publishAnalysisResult(item, result, false);
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await markAttachmentError(item.attachmentId, errorMessage);
      return true; // Still return true - item was attempted
    } finally {
      this.processingCount--;
    }
  }

  /**
   * Phase 160.1.1: Publish analysis result to bus
   */
  private async publishAnalysisResult(
    item: AttachmentProcessingRequest,
    result: MediaAnalysisOutput,
    success: boolean
  ): Promise<void> {
    const msg: MediaAnalyzeResultMsg = {
      kind: 'MEDIA_ANALYZE_RESULT',
      attachmentId: item.attachmentId,
      projectId: item.projectId,
      analysisType: result.analysisType,
      success,
      result: result.result ? {
        text: result.result.text,
        description: result.result.description,
        summary: result.result.summary,
        pageCount: result.result.pageCount,
        language: result.result.language,
        metadata: result.result.metadata,
      } : undefined,
      error: result.error,
      processingTimeMs: result.processingTimeMs,
      provider: result.provider,
    };

    // Broadcast to any listeners
    try {
      await this.bus.publish({
        id: `media-result-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: 'media',
        to: 'broadcast',
        kind: 'MEDIA_ANALYZE_RESULT',
        context: { projectId: item.projectId },
        safety: { level: 'low' },
        payload: msg,
      });
    } catch (e) {
      console.warn('[160.1.1][MEDIA_AGENT] Failed to publish result:', e);
    }
  }

  private mapProcessType(processType: string): MediaAnalysisType {
    switch (processType) {
      case 'ocr':
        return 'ocr';
      case 'transcribe':
        return 'extract_text'; // Will be handled by AudioAgent in 161
      case 'analyze':
        return 'describe';
      case 'extract_text':
        return 'extract_text';
      case 'thumbnail':
        return 'describe'; // Placeholder
      case 'embed':
        return 'embed';
      default:
        return 'describe';
    }
  }

  // ===========================================================================
  // Core Analysis (Placeholder - will integrate with Vision API)
  // ===========================================================================

  async analyze(input: MediaAnalysisInput): Promise<MediaAnalysisOutput> {
    const startTime = Date.now();

    console.log('[160.1][MEDIA_AGENT] Analyzing:', input.attachmentId, input.analysisType);

    // Get attachment details
    const attachment = await getAttachmentForProcessing(input.attachmentId);
    if (!attachment) {
      return {
        attachmentId: input.attachmentId,
        analysisType: input.analysisType,
        success: false,
        error: 'Attachment not found',
      };
    }

    // Check if analysis type is supported for this MIME type
    if (!isAnalysisSupported(input.analysisType, attachment.mimeType)) {
      return {
        attachmentId: input.attachmentId,
        analysisType: input.analysisType,
        success: false,
        error: `Analysis type '${input.analysisType}' not supported for MIME type '${attachment.mimeType}'`,
      };
    }

    // Placeholder analysis results (will be replaced with real API calls)
    const result = await this.performAnalysis(input, attachment);

    return {
      ...result,
      processingTime: Date.now() - startTime,
    };
  }

  private async performAnalysis(
    input: MediaAnalysisInput,
    attachment: { filename: string; mimeType: string; sizeBytes: number }
  ): Promise<MediaAnalysisOutput> {
    // Placeholder implementation
    // In production, this will call Vision API, OCR services, etc.

    switch (input.analysisType) {
      case 'describe':
        return {
          attachmentId: input.attachmentId,
          analysisType: 'describe',
          success: true,
          result: {
            description: `[Placeholder] Image "${attachment.filename}" (${attachment.mimeType}, ${Math.round(attachment.sizeBytes / 1024)}KB). Vision API integration pending.`,
            confidence: 0.85,
          },
        };

      case 'ocr':
        return {
          attachmentId: input.attachmentId,
          analysisType: 'ocr',
          success: true,
          result: {
            text: `[Placeholder] OCR text extraction from "${attachment.filename}". OCR API integration pending.`,
            confidence: 0.9,
          },
        };

      case 'extract_text':
        return {
          attachmentId: input.attachmentId,
          analysisType: 'extract_text',
          success: true,
          result: {
            text: `[Placeholder] Text extracted from "${attachment.filename}". PDF/document parser integration pending.`,
            wordCount: 0,
            pageCount: 1,
          },
        };

      case 'summarize':
        return {
          attachmentId: input.attachmentId,
          analysisType: 'summarize',
          success: true,
          result: {
            summary: `[Placeholder] Summary of "${attachment.filename}". LLM summarization integration pending.`,
            wordCount: 0,
          },
        };

      case 'embed':
        return {
          attachmentId: input.attachmentId,
          analysisType: 'embed',
          success: true,
          result: {
            embeddings: new Array(384).fill(0).map(() => Math.random() * 2 - 1), // Placeholder 384-dim vector
            metadata: {
              model: 'placeholder',
              dimensions: 384,
            },
          },
        };

      default:
        return {
          attachmentId: input.attachmentId,
          analysisType: input.analysisType,
          success: false,
          error: `Unknown analysis type: ${input.analysisType}`,
        };
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Manually trigger analysis for an attachment
   */
  async analyzeAttachment(
    attachmentId: string,
    projectId: string,
    analysisType: MediaAnalysisType = 'describe'
  ): Promise<MediaAnalysisOutput> {
    return this.analyze({
      attachmentId,
      projectId,
      analysisType,
    });
  }

  /**
   * Stop the processing loop
   * Phase 160.1.1: Simply set running to false, loop will exit naturally
   */
  stop() {
    this.running = false;
    console.log('[160.1.1][MEDIA_AGENT] Stop requested, loop will exit');
  }

  /**
   * Check if agent is running
   */
  isRunning(): boolean {
    return this.running;
  }
}

console.log('[160.1.1][MEDIA_AGENT] Module loaded (v1.1 - Hardened)');
