// orchestrator/core/uiBuilder/firestoreUiBuilderStore.ts
// =============================================================================
// Phase 163.1 – Firestore UI Builder Store
// Persistence layer for UI generation requests and proposals
// =============================================================================

import {
  UiBuilderStore,
  UiGenerationRequest,
  UiGenerationProposal,
  UiGenerationStatus,
} from './types';

interface FirestoreRef {
  collection(name: string): FirestoreCollection;
}

interface FirestoreCollection {
  doc(id?: string): FirestoreDoc;
  where(field: string, op: string, value: unknown): FirestoreQuery;
  orderBy(field: string, direction?: 'asc' | 'desc'): FirestoreQuery;
  limit(n: number): FirestoreQuery;
  get(): Promise<FirestoreQuerySnapshot>;
}

interface FirestoreDoc {
  id: string;
  get(): Promise<FirestoreDocSnapshot>;
  set(data: unknown): Promise<void>;
  update(data: unknown): Promise<void>;
}

interface FirestoreQuery {
  where(field: string, op: string, value: unknown): FirestoreQuery;
  orderBy(field: string, direction?: 'asc' | 'desc'): FirestoreQuery;
  limit(n: number): FirestoreQuery;
  get(): Promise<FirestoreQuerySnapshot>;
}

interface FirestoreDocSnapshot {
  exists: boolean;
  id: string;
  data(): Record<string, unknown> | undefined;
}

interface FirestoreQuerySnapshot {
  docs: FirestoreDocSnapshot[];
  empty: boolean;
}

function generateId(prefix = 'ui'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class FirestoreUiBuilderStore implements UiBuilderStore {
  private readonly requestsCol: string = 'uiGenerationRequests';
  private readonly proposalsCol: string = 'uiGenerationProposals';

  constructor(private readonly db: FirestoreRef) {
    console.log('[163.1][UI_STORE] FirestoreUiBuilderStore initialized');
  }

  // =========================================================================
  // Request Operations
  // =========================================================================

  async createRequest(
    req: Omit<UiGenerationRequest, 'id' | 'createdAt'>
  ): Promise<UiGenerationRequest> {
    const id = generateId('uireq');
    const now = new Date().toISOString();

    const request: UiGenerationRequest = {
      ...req,
      id,
      createdAt: now,
    };

    await this.db.collection(this.requestsCol).doc(id).set(request);
    console.log('[163.1][UI_STORE] Request created:', id);

    return request;
  }

  async getRequest(requestId: string): Promise<UiGenerationRequest | null> {
    const snap = await this.db.collection(this.requestsCol).doc(requestId).get();
    if (!snap.exists) return null;
    return snap.data() as UiGenerationRequest;
  }

  async listRequests(projectId: string, limit = 20): Promise<UiGenerationRequest[]> {
    const snap = await this.db
      .collection(this.requestsCol)
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((d) => d.data() as UiGenerationRequest);
  }

  // =========================================================================
  // Proposal Operations
  // =========================================================================

  async createProposal(
    proposal: Omit<UiGenerationProposal, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<UiGenerationProposal> {
    const id = generateId('uiprop');
    const now = new Date().toISOString();

    const fullProposal: UiGenerationProposal = {
      ...proposal,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.collection(this.proposalsCol).doc(id).set(fullProposal);
    console.log('[163.1][UI_STORE] Proposal created:', id);

    return fullProposal;
  }

  async getProposal(proposalId: string): Promise<UiGenerationProposal | null> {
    const snap = await this.db.collection(this.proposalsCol).doc(proposalId).get();
    if (!snap.exists) return null;
    return snap.data() as UiGenerationProposal;
  }

  async getProposalByRequest(requestId: string): Promise<UiGenerationProposal | null> {
    const snap = await this.db
      .collection(this.proposalsCol)
      .where('requestId', '==', requestId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as UiGenerationProposal;
  }

  async updateProposal(
    proposalId: string,
    updates: Partial<UiGenerationProposal>
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db.collection(this.proposalsCol).doc(proposalId).update({
      ...updates,
      updatedAt: now,
    });
    console.log('[163.1][UI_STORE] Proposal updated:', proposalId);
  }

  async listProposals(
    projectId: string,
    status?: UiGenerationStatus
  ): Promise<UiGenerationProposal[]> {
    let query = this.db
      .collection(this.proposalsCol)
      .where('projectId', '==', projectId);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snap = await query.orderBy('createdAt', 'desc').limit(50).get();
    return snap.docs.map((d) => d.data() as UiGenerationProposal);
  }

  // =========================================================================
  // Approval Workflow
  // =========================================================================

  async approveProposal(proposalId: string, planId: string): Promise<void> {
    await this.updateProposal(proposalId, {
      status: 'approved',
      planId,
    });
    console.log('[163.1][UI_STORE] Proposal approved:', proposalId, '→ Plan:', planId);
  }

  async rejectProposal(proposalId: string, reason?: string): Promise<void> {
    await this.updateProposal(proposalId, {
      status: 'rejected',
      errorMessage: reason || 'Rejected by user',
    });
    console.log('[163.1][UI_STORE] Proposal rejected:', proposalId);
  }
}

console.log('[163.1][UI_BUILDER] FirestoreUiBuilderStore module loaded');
