// orchestrator/core/mediaPreprocess/firestoreMediaPreprocessStore.ts
// =============================================================================
// Phase 164.0 – Firestore Media Preprocess Store
// Persistence layer for preprocessing jobs and results
// =============================================================================

import {
  MediaPreprocessStore,
  MediaPreprocessJob,
  MediaPreprocessResult,
  JobStatus,
  MediaKind,
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
  delete(): Promise<void>;
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

function generateId(prefix = 'mpj'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class FirestoreMediaPreprocessStore implements MediaPreprocessStore {
  private readonly jobsCol: string = 'mediaPreprocessJobs';
  private readonly resultsCol: string = 'mediaPreprocessResults';

  constructor(private readonly db: FirestoreRef) {
    console.log('[164.0][PREPROCESS_STORE] FirestoreMediaPreprocessStore initialized');
  }

  // =========================================================================
  // Job Operations
  // =========================================================================

  async createJob(
    job: Omit<MediaPreprocessJob, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MediaPreprocessJob> {
    const id = generateId('mpj');
    const now = Date.now();

    const fullJob: MediaPreprocessJob = {
      ...job,
      id,
      status: job.status || 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    await this.db.collection(this.jobsCol).doc(id).set(fullJob);
    console.log('[164.0][PREPROCESS_STORE] Job created:', id, job.kind);

    return fullJob;
  }

  async getJob(jobId: string): Promise<MediaPreprocessJob | null> {
    const snap = await this.db.collection(this.jobsCol).doc(jobId).get();
    if (!snap.exists) return null;
    return snap.data() as MediaPreprocessJob;
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    errorMessage?: string
  ): Promise<void> {
    const updates: Partial<MediaPreprocessJob> = {
      status,
      updatedAt: Date.now(),
    };
    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    await this.db.collection(this.jobsCol).doc(jobId).update(updates);
    console.log('[164.0][PREPROCESS_STORE] Job status updated:', jobId, status);
  }

  async listJobs(projectId: string, limit = 50): Promise<MediaPreprocessJob[]> {
    const snap = await this.db
      .collection(this.jobsCol)
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((d) => d.data() as MediaPreprocessJob);
  }

  // =========================================================================
  // Result Operations
  // =========================================================================

  async saveResult(result: MediaPreprocessResult): Promise<void> {
    await this.db.collection(this.resultsCol).doc(result.id).set(result);
    console.log('[164.0][PREPROCESS_STORE] Result saved:', result.id);
  }

  async getResult(jobId: string): Promise<MediaPreprocessResult | null> {
    const snap = await this.db.collection(this.resultsCol).doc(jobId).get();
    if (!snap.exists) return null;
    return snap.data() as MediaPreprocessResult;
  }

  async getResultByAttachment(
    projectId: string,
    attachmentId: string
  ): Promise<MediaPreprocessResult | null> {
    const snap = await this.db
      .collection(this.resultsCol)
      .where('projectId', '==', projectId)
      .where('attachmentId', '==', attachmentId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as MediaPreprocessResult;
  }

  async listResults(
    projectId: string,
    kind?: MediaKind
  ): Promise<MediaPreprocessResult[]> {
    let query = this.db
      .collection(this.resultsCol)
      .where('projectId', '==', projectId);

    if (kind) {
      query = query.where('kind', '==', kind);
    }

    const snap = await query.orderBy('createdAt', 'desc').limit(100).get();
    return snap.docs.map((d) => d.data() as MediaPreprocessResult);
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  async deleteJob(jobId: string): Promise<void> {
    await this.db.collection(this.jobsCol).doc(jobId).delete();
    console.log('[164.0][PREPROCESS_STORE] Job deleted:', jobId);
  }

  async deleteResult(jobId: string): Promise<void> {
    await this.db.collection(this.resultsCol).doc(jobId).delete();
    console.log('[164.0][PREPROCESS_STORE] Result deleted:', jobId);
  }
}

console.log('[164.0][MEDIA_PREPROCESS] FirestoreMediaPreprocessStore module loaded');
