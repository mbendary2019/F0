// desktop/src/lib/ace/aceJobWatcher.ts
// =============================================================================
// Phase 150.3.9 – ACE Job Watcher for Desktop IDE
// Watches Firestore for pending ACE jobs created by Web IDE
// Executes jobs and updates status in Firestore
// =============================================================================

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';

/**
 * ACE Job Status
 */
export type AceJobStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * ACE Job from Firestore
 */
export interface AceJobDocument {
  id: string;
  type: 'guided' | 'auto';
  source: 'web' | 'desktop';
  status: AceJobStatus;
  createdAt: string;
  environment: 'desktop' | 'cloud';
  notes?: string;
  runId?: string | null;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

/**
 * ACE Job execution result
 */
export interface AceJobExecutionResult {
  success: boolean;
  runId?: string;
  error?: string;
  filesProcessed: number;
  totalApplied: number;
  totalErrors: number;
}

/**
 * Job executor function type - provided by the app
 */
export type AceJobExecutorFn = (
  job: AceJobDocument,
  projectId: string,
) => Promise<AceJobExecutionResult>;

/**
 * Watcher state
 */
export interface AceJobWatcherState {
  isWatching: boolean;
  projectId: string | null;
  activeJobId: string | null;
  pendingJobs: AceJobDocument[];
}

/**
 * Watcher options
 */
export interface AceJobWatcherOptions {
  /** Firestore instance */
  db: Firestore;
  /** Project ID to watch */
  projectId: string;
  /** Function to execute jobs */
  executor: AceJobExecutorFn;
  /** Callback when state changes */
  onStateChange?: (state: AceJobWatcherState) => void;
  /** Callback when job execution starts */
  onJobStart?: (job: AceJobDocument) => void;
  /** Callback when job execution completes */
  onJobComplete?: (job: AceJobDocument, result: AceJobExecutionResult) => void;
}

/**
 * ACE Job Watcher Class
 * Watches Firestore for pending jobs and executes them
 */
export class AceJobWatcher {
  private db: Firestore;
  private projectId: string;
  private executor: AceJobExecutorFn;
  private unsubscribe: Unsubscribe | null = null;
  private state: AceJobWatcherState;
  private isExecuting = false;
  private onStateChange?: (state: AceJobWatcherState) => void;
  private onJobStart?: (job: AceJobDocument) => void;
  private onJobComplete?: (job: AceJobDocument, result: AceJobExecutionResult) => void;

  constructor(options: AceJobWatcherOptions) {
    this.db = options.db;
    this.projectId = options.projectId;
    this.executor = options.executor;
    this.onStateChange = options.onStateChange;
    this.onJobStart = options.onJobStart;
    this.onJobComplete = options.onJobComplete;

    this.state = {
      isWatching: false,
      projectId: options.projectId,
      activeJobId: null,
      pendingJobs: [],
    };

    console.log('[150.3.9][ACE_JOB_WATCHER] Initialized', { projectId: this.projectId });
  }

  /**
   * Start watching for pending jobs
   */
  start(): void {
    if (this.unsubscribe) {
      console.warn('[150.3.9][ACE_JOB_WATCHER] Already watching, ignoring start()');
      return;
    }

    console.log('[150.3.9][ACE_JOB_WATCHER] Starting watcher...', { projectId: this.projectId });

    // Query for pending jobs that should run on desktop
    const jobsRef = collection(this.db, 'projects', this.projectId, 'aceJobs');
    const pendingQuery = query(
      jobsRef,
      where('status', '==', 'pending'),
      where('environment', '==', 'desktop'),
    );

    this.unsubscribe = onSnapshot(
      pendingQuery,
      (snapshot) => {
        const jobs: AceJobDocument[] = [];

        snapshot.forEach((docSnapshot) => {
          jobs.push({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          } as AceJobDocument);
        });

        console.log('[150.3.9][ACE_JOB_WATCHER] Pending jobs updated', {
          count: jobs.length,
          jobIds: jobs.map((j) => j.id),
        });

        this.state.pendingJobs = jobs;
        this.state.isWatching = true;
        this.notifyStateChange();

        // Process pending jobs
        this.processNextJob();
      },
      (error) => {
        console.error('[150.3.9][ACE_JOB_WATCHER] Snapshot error:', error);
        this.state.isWatching = false;
        this.notifyStateChange();
      },
    );

    this.state.isWatching = true;
    this.notifyStateChange();
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.state.isWatching = false;
    this.state.pendingJobs = [];
    this.notifyStateChange();

    console.log('[150.3.9][ACE_JOB_WATCHER] Stopped');
  }

  /**
   * Get current state
   */
  getState(): AceJobWatcherState {
    return { ...this.state };
  }

  /**
   * Process the next pending job
   */
  private async processNextJob(): Promise<void> {
    // Skip if already executing
    if (this.isExecuting) {
      console.log('[150.3.9][ACE_JOB_WATCHER] Already executing, skipping...');
      return;
    }

    // Get next pending job
    const nextJob = this.state.pendingJobs[0];
    if (!nextJob) {
      console.log('[150.3.9][ACE_JOB_WATCHER] No pending jobs');
      return;
    }

    this.isExecuting = true;
    this.state.activeJobId = nextJob.id;
    this.notifyStateChange();

    console.log('[150.3.9][ACE_JOB_WATCHER] Executing job...', {
      jobId: nextJob.id,
      type: nextJob.type,
    });

    try {
      // Update job status to running
      await this.updateJobStatus(nextJob.id, 'running');

      // Notify job start
      this.onJobStart?.(nextJob);

      // Execute the job
      const result = await this.executor(nextJob, this.projectId);

      console.log('[150.3.9][ACE_JOB_WATCHER] Job execution result', {
        jobId: nextJob.id,
        success: result.success,
        runId: result.runId,
        filesProcessed: result.filesProcessed,
        totalApplied: result.totalApplied,
      });

      // Update job status based on result
      if (result.success) {
        await this.updateJobStatus(nextJob.id, 'completed', result.runId);
      } else {
        await this.updateJobStatus(nextJob.id, 'failed', null, result.error);
      }

      // Notify job complete
      this.onJobComplete?.(nextJob, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[150.3.9][ACE_JOB_WATCHER] Job execution failed:', error);

      // Update job status to failed
      await this.updateJobStatus(nextJob.id, 'failed', null, errorMessage);

      // Notify job complete with error
      this.onJobComplete?.(nextJob, {
        success: false,
        error: errorMessage,
        filesProcessed: 0,
        totalApplied: 0,
        totalErrors: 1,
      });
    } finally {
      this.isExecuting = false;
      this.state.activeJobId = null;
      this.notifyStateChange();
    }
  }

  /**
   * Update job status in Firestore
   */
  private async updateJobStatus(
    jobId: string,
    status: AceJobStatus,
    runId?: string | null,
    error?: string | null,
  ): Promise<void> {
    const jobRef = doc(this.db, 'projects', this.projectId, 'aceJobs', jobId);

    const updateData: Record<string, unknown> = {
      status,
    };

    if (status === 'running') {
      updateData.startedAt = new Date().toISOString();
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date().toISOString();
    }

    if (runId !== undefined) {
      updateData.runId = runId;
    }

    if (error !== undefined) {
      updateData.error = error;
    }

    console.log('[150.3.9][ACE_JOB_WATCHER] Updating job status', {
      jobId,
      status,
      runId,
      error,
    });

    await updateDoc(jobRef, updateData);
  }

  /**
   * Notify state change
   */
  private notifyStateChange(): void {
    this.onStateChange?.({ ...this.state });
  }
}

/**
 * Create a job watcher instance
 */
export function createAceJobWatcher(options: AceJobWatcherOptions): AceJobWatcher {
  return new AceJobWatcher(options);
}

/**
 * Default ACE job executor placeholder
 * This should be replaced with actual ACE execution logic
 */
export async function defaultAceJobExecutor(
  job: AceJobDocument,
  projectId: string,
): Promise<AceJobExecutionResult> {
  console.log('[150.3.9][ACE_EXECUTOR] Executing ACE job...', {
    jobId: job.id,
    projectId,
    type: job.type,
  });

  // TODO: Implement actual ACE execution
  // This is a placeholder that simulates execution

  // Simulate some processing time
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // For now, return a mock result
  // The actual implementation should:
  // 1. Run the ACE engine on the project
  // 2. Apply fixes
  // 3. Create an AceRun document in Firestore
  // 4. Return the runId

  const mockRunId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  console.log('[150.3.9][ACE_EXECUTOR] Mock execution complete', { mockRunId });

  return {
    success: true,
    runId: mockRunId,
    filesProcessed: 10,
    totalApplied: 3,
    totalErrors: 0,
  };
}

export default {
  AceJobWatcher,
  createAceJobWatcher,
  defaultAceJobExecutor,
};
