import { Timestamp } from 'firebase/firestore';

/**
 * Asset File Types
 */
export type AssetFileType = 'image' | 'video' | 'audio';

/**
 * Job Status States
 */
export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

/**
 * AI Provider Types
 */
export type AIProvider = 'runway' | 'veo' | 'local';

/**
 * Job Types
 */
export type JobType = 'generate' | 'transform' | 'enhance';

/**
 * Asset Severity for moderation
 */
export type AssetSeverity = 'safe' | 'warning' | 'blocked';

/**
 * Main Asset Interface
 * Represents a media file uploaded by a user
 */
export interface Asset {
  id: string;
  userId: string;
  fileName: string;
  fileType: AssetFileType;
  fileSize: number;
  storagePath: string;
  storageUrl: string;
  thumbnailUrl?: string;

  // Job tracking
  jobId?: string;
  jobStatus?: JobStatus;

  // Metadata
  width?: number;
  height?: number;
  duration?: number; // For video/audio in seconds

  // Moderation
  moderationStatus?: AssetSeverity;
  moderationNotes?: string;

  // Output
  outputUrl?: string;
  outputStoragePath?: string;

  // Tags and categories
  tags?: string[];
  category?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Job Interface
 * Represents an AI processing job
 */
export interface Job {
  id: string;
  assetId: string;
  userId: string;

  // Job configuration
  type: JobType;
  provider: AIProvider;
  status: JobStatus;

  // Parameters for AI processing
  parameters: {
    duration?: number;
    style?: string;
    background?: string;
    prompt?: string;
    aspectRatio?: string;
    resolution?: string;
    fps?: number;
  };

  // Results
  outputUrl?: string;
  outputStoragePath?: string;
  errorMessage?: string;

  // Progress tracking
  progress?: number; // 0-100
  estimatedCompletionTime?: Timestamp;

  // Webhooks
  webhookUrl?: string;
  webhookSecret?: string;

  // External provider tracking
  externalJobId?: string;

  // Timestamps
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Scene Interface
 * Represents a collection of assets and jobs for a project
 */
export interface Scene {
  id: string;
  userId: string;
  name: string;
  description?: string;

  // Assets in this scene
  assetIds: string[];

  // Scene configuration
  duration?: number;
  resolution?: string;
  fps?: number;

  // Status
  status: 'draft' | 'processing' | 'ready' | 'published';

  // Output
  outputUrl?: string;
  outputStoragePath?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}

/**
 * Webhook Payload Interface
 * Received from external AI providers
 */
export interface WebhookPayload {
  jobId: string;
  status: JobStatus;
  progress?: number;
  outputUrl?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

/**
 * Upload Progress Interface
 * For tracking file upload progress
 */
export interface UploadProgress {
  fileName: string;
  progress: number; // 0-100
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

/**
 * Asset Filter Interface
 * For filtering assets in the UI
 */
export interface AssetFilter {
  fileType?: AssetFileType;
  jobStatus?: JobStatus;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  category?: string;
  searchQuery?: string;
}

/**
 * Asset Sort Options
 */
export type AssetSortBy = 'createdAt' | 'updatedAt' | 'fileName' | 'fileSize';
export type SortOrder = 'asc' | 'desc';

export interface AssetSort {
  sortBy: AssetSortBy;
  order: SortOrder;
}
