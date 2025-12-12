// orchestrator/core/attachments/attachmentStore.ts
// =============================================================================
// Phase 158.1 – Attachment Store
// In-memory store for development (with Firestore-ready interface)
// =============================================================================

import {
  ProjectAttachment,
  AttachmentStore,
  AttachmentStatus,
} from './types';

function generateId(prefix = 'att'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// =============================================================================
// In-Memory Store (Development)
// =============================================================================

export class InMemoryAttachmentStore implements AttachmentStore {
  private attachments = new Map<string, ProjectAttachment>();

  async create(attachment: ProjectAttachment): Promise<void> {
    this.attachments.set(attachment.id, attachment);
    console.log('[158.1][ATT_STORE] Created attachment:', attachment.id, attachment.filename);
  }

  async get(id: string): Promise<ProjectAttachment | null> {
    return this.attachments.get(id) ?? null;
  }

  async listForProject(projectId: string, limit = 50): Promise<ProjectAttachment[]> {
    const projectAttachments = Array.from(this.attachments.values())
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return projectAttachments.slice(0, limit);
  }

  async listForConversation(conversationId: string): Promise<ProjectAttachment[]> {
    return Array.from(this.attachments.values())
      .filter((a) => a.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async updateStatus(id: string, status: AttachmentStatus): Promise<void> {
    const att = this.attachments.get(id);
    if (att) {
      att.status = status;
      this.attachments.set(id, att);
      console.log('[158.1][ATT_STORE] Updated status:', id, status);
    }
  }

  async updateMetadata(id: string, metadata: Record<string, unknown>): Promise<void> {
    const att = this.attachments.get(id);
    if (att) {
      att.metadata = { ...att.metadata, ...metadata };
      this.attachments.set(id, att);
      console.log('[158.1][ATT_STORE] Updated metadata:', id);
    }
  }

  async delete(id: string): Promise<void> {
    this.attachments.delete(id);
    console.log('[158.1][ATT_STORE] Deleted attachment:', id);
  }

  // Debugging helpers
  getAllAttachments(): ProjectAttachment[] {
    return Array.from(this.attachments.values());
  }

  getCount(): number {
    return this.attachments.size;
  }
}

// =============================================================================
// Global Singleton (persists across Next.js hot reloads)
// =============================================================================

declare global {
  // eslint-disable-next-line no-var
  var __attachmentStore: InMemoryAttachmentStore | undefined;
}

let attachmentStore: InMemoryAttachmentStore | null = global.__attachmentStore || null;

export function getAttachmentStore(): InMemoryAttachmentStore {
  if (!attachmentStore) {
    attachmentStore = new InMemoryAttachmentStore();
    global.__attachmentStore = attachmentStore;
    console.log('[158.1][ATT_STORE] Initialized attachment store');
  }
  return attachmentStore;
}

// =============================================================================
// Helper: Create new attachment ID
// =============================================================================

export function createAttachmentId(): string {
  return generateId('att');
}

console.log('[158.1][ATTACHMENTS] AttachmentStore module loaded');
