// orchestrator/core/attachments/mediaAgentHooks.ts
// =============================================================================
// Phase 158.5 – Media/Audio Agent Hooks
// Interface for future MediaAgent (160) and AudioAgent (161) to process attachments
// =============================================================================

import {
  ProjectAttachment,
  AttachmentKind,
  AttachmentStatus,
} from './types';
import { getAttachmentStore } from './attachmentStore';

// =============================================================================
// Types for Agent Processing
// =============================================================================

export interface AttachmentProcessingRequest {
  attachmentId: string;
  projectId: string;
  processType: AttachmentProcessType;
  options?: Record<string, unknown>;
}

export type AttachmentProcessType =
  | 'ocr'           // Extract text from images
  | 'transcribe'    // Transcribe audio
  | 'analyze'       // General analysis (describe image, summarize doc)
  | 'embed'         // Generate embeddings for RAG
  | 'thumbnail'     // Generate thumbnail
  | 'extract_text'; // Extract text from PDF/document

export interface AttachmentProcessingResult {
  attachmentId: string;
  processType: AttachmentProcessType;
  success: boolean;
  data?: {
    text?: string;
    description?: string;
    embeddings?: number[];
    thumbnailUrl?: string;
    metadata?: Record<string, unknown>;
  };
  error?: string;
}

// =============================================================================
// Attachment Query Helpers
// =============================================================================

/**
 * Get attachment by ID (for agents)
 */
export async function getAttachmentForProcessing(
  attachmentId: string
): Promise<ProjectAttachment | null> {
  const store = getAttachmentStore();
  return store.get(attachmentId);
}

/**
 * Get all attachments of a specific kind for a project
 */
export async function getAttachmentsByKind(
  projectId: string,
  kind: AttachmentKind
): Promise<ProjectAttachment[]> {
  const store = getAttachmentStore();
  const all = await store.listForProject(projectId);
  return all.filter((a) => a.kind === kind);
}

/**
 * Get unprocessed attachments (status = 'raw')
 */
export async function getUnprocessedAttachments(
  projectId: string,
  kind?: AttachmentKind
): Promise<ProjectAttachment[]> {
  const store = getAttachmentStore();
  const all = await store.listForProject(projectId);
  return all.filter((a) => {
    if (a.status !== 'raw') return false;
    if (kind && a.kind !== kind) return false;
    return true;
  });
}

/**
 * Get attachments for a conversation (for context)
 */
export async function getConversationAttachments(
  conversationId: string
): Promise<ProjectAttachment[]> {
  const store = getAttachmentStore();
  return store.listForConversation(conversationId);
}

// =============================================================================
// Status Update Helpers
// =============================================================================

/**
 * Mark attachment as processing
 */
export async function markAttachmentProcessing(attachmentId: string): Promise<void> {
  const store = getAttachmentStore();
  await store.updateStatus(attachmentId, 'processing');
  console.log('[158.5][HOOKS] Marked as processing:', attachmentId);
}

/**
 * Mark attachment as ready with metadata
 */
export async function markAttachmentReady(
  attachmentId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const store = getAttachmentStore();
  await store.updateStatus(attachmentId, 'ready');
  if (metadata) {
    await store.updateMetadata(attachmentId, metadata);
  }
  console.log('[158.5][HOOKS] Marked as ready:', attachmentId);
}

/**
 * Mark attachment as error
 */
export async function markAttachmentError(
  attachmentId: string,
  errorMessage: string
): Promise<void> {
  const store = getAttachmentStore();
  await store.updateStatus(attachmentId, 'error');
  await store.updateMetadata(attachmentId, { error: errorMessage });
  console.log('[158.5][HOOKS] Marked as error:', attachmentId, errorMessage);
}

// =============================================================================
// Processing Queue (Placeholder for Phase 160/161)
// =============================================================================

// In-memory queue for development
const processingQueue: AttachmentProcessingRequest[] = [];

/**
 * Queue attachment for processing
 * MediaAgent/AudioAgent will pick these up
 */
export function queueForProcessing(request: AttachmentProcessingRequest): void {
  processingQueue.push(request);
  console.log('[158.5][HOOKS] Queued for processing:', request.attachmentId, request.processType);
}

/**
 * Get next item from processing queue
 */
export function getNextProcessingItem(): AttachmentProcessingRequest | undefined {
  return processingQueue.shift();
}

/**
 * Get queue length
 */
export function getProcessingQueueLength(): number {
  return processingQueue.length;
}

// =============================================================================
// Convenience: Auto-queue new attachments
// =============================================================================

/**
 * Auto-queue attachment based on kind
 * Called after upload to automatically process attachments
 */
export function autoQueueAttachment(attachment: ProjectAttachment): void {
  switch (attachment.kind) {
    case 'image':
      queueForProcessing({
        attachmentId: attachment.id,
        projectId: attachment.projectId,
        processType: 'ocr',
      });
      queueForProcessing({
        attachmentId: attachment.id,
        projectId: attachment.projectId,
        processType: 'analyze',
      });
      break;

    case 'audio':
      queueForProcessing({
        attachmentId: attachment.id,
        projectId: attachment.projectId,
        processType: 'transcribe',
      });
      break;

    case 'pdf':
    case 'document':
      queueForProcessing({
        attachmentId: attachment.id,
        projectId: attachment.projectId,
        processType: 'extract_text',
      });
      break;

    default:
      // No auto-processing for other types
      break;
  }
}

console.log('[158.5][ATTACHMENTS] MediaAgentHooks module loaded');
