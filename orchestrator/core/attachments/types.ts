// orchestrator/core/attachments/types.ts
// =============================================================================
// Phase 158.1 – Attachment Types (v1.1 - Phase 160.4 Hardening)
// Data model for file attachments in projects
// Phase 160.4: Added per-analysisType status and media analysis fields
// =============================================================================

import type { AttachmentMediaAnalysis } from '../media/types';

export type AttachmentKind =
  | 'image'
  | 'pdf'
  | 'document'
  | 'audio'
  | 'other';

export type AttachmentStatus = 'raw' | 'processing' | 'ready' | 'error';

/**
 * Phase 160.4: Extraction strength classification
 */
export type ExtractionStrength = 'STRONG' | 'WEAK' | 'EMPTY';

export interface ProjectAttachment {
  id: string;
  projectId: string;
  storagePath: string;      // "projects/{projectId}/attachments/{id}.{ext}"
  downloadUrl?: string;     // signed or public URL
  filename: string;
  mimeType: string;
  sizeBytes: number;

  kind: AttachmentKind;
  createdBy: string;
  createdAt: string;

  // Optional links to chat/plans
  conversationId?: string;
  turnId?: string;
  planId?: string;

  // Processing status for Media/Audio agents (legacy - overall status)
  status?: AttachmentStatus;

  // Phase 160.4: Per-analysisType status tracking
  // This replaces the generic metadata for media analysis
  mediaAnalysis?: AttachmentMediaAnalysis;

  // Phase 160.4: Extraction quality metrics
  extractionStrength?: ExtractionStrength;
  extractedTextLen?: number;

  // Additional metadata (for non-media data)
  metadata?: Record<string, unknown>;
}

export interface AttachmentStore {
  create(attachment: ProjectAttachment): Promise<void>;
  get(id: string): Promise<ProjectAttachment | null>;
  listForProject(projectId: string, limit?: number): Promise<ProjectAttachment[]>;
  listForConversation(conversationId: string): Promise<ProjectAttachment[]>;
  updateStatus(id: string, status: AttachmentStatus): Promise<void>;
  updateMetadata(id: string, metadata: Record<string, unknown>): Promise<void>;
  delete(id: string): Promise<void>;

  // Phase 160.4: New methods for media analysis
  updateMediaAnalysis?(id: string, analysis: AttachmentMediaAnalysis): Promise<void>;
  updateExtractionStrength?(id: string, strength: ExtractionStrength, textLen: number): Promise<void>;
}

// Helper to determine attachment kind from MIME type
export function guessAttachmentKind(mimeType: string): AttachmentKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('word') ||
    mimeType.includes('officedocument') ||
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown'
  ) {
    return 'document';
  }
  return 'other';
}

// File size limits (in bytes)
export const ATTACHMENT_LIMITS = {
  maxFileSize: 50 * 1024 * 1024,  // 50MB
  maxImageSize: 10 * 1024 * 1024, // 10MB
  maxAudioSize: 25 * 1024 * 1024, // 25MB
  maxPdfSize: 20 * 1024 * 1024,   // 20MB
};

// Allowed MIME types
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-m4a',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
];

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

console.log('[158.1][ATTACHMENTS] Types module loaded (v1.1 - Phase 160.4)');
