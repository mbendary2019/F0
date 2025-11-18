import { Timestamp } from 'firebase/firestore';

/**
 * Deployment Target Platforms
 */
export type DeployTarget = 'firebase' | 'vercel' | 'github-pages';

/**
 * Deployment Environments
 */
export type DeployEnv = 'production' | 'staging' | 'preview' | 'custom';

/**
 * Deployment Status States
 */
export type DeployStatus = 'queued' | 'deploying' | 'success' | 'failed' | 'cancelled';

/**
 * Log Level for deployment logs
 */
export type LogLevel = 'info' | 'warning' | 'error' | 'success';

/**
 * Deployment Job Interface
 * Represents a single deployment job
 */
export interface DeployJob {
  id: string;
  userId: string;

  // Target configuration
  target: DeployTarget;
  env: DeployEnv;

  // Status tracking
  status: DeployStatus;

  // Timing
  startTime: Timestamp;
  endTime?: Timestamp;
  duration?: number; // in seconds

  // Logs and output
  logs: DeployLog[];
  resultUrl?: string;
  deploymentId?: string; // External deployment ID from provider

  // Configuration
  config?: DeployConfig;

  // Error tracking
  errorMessage?: string;
  errorStack?: string;

  // Metadata
  branch?: string;
  commit?: string;
  triggeredBy?: string; // 'manual' | 'webhook' | 'schedule'

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Deployment Log Entry
 */
export interface DeployLog {
  timestamp: Timestamp;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Deployment Configuration
 * Platform-specific settings
 */
export interface DeployConfig {
  // Firebase specific
  firebase?: {
    projectId: string;
    targets?: string[]; // ['hosting', 'functions', 'firestore']
    channelId?: string; // For preview channels
  };

  // Vercel specific
  vercel?: {
    projectId: string;
    teamId?: string;
    production: boolean;
    gitSource?: {
      type: 'github' | 'gitlab' | 'bitbucket';
      repo: string;
      ref: string;
    };
  };

  // GitHub Pages specific
  githubPages?: {
    repo: string;
    branch: string;
    token?: string;
  };

  // Environment variables
  env?: Record<string, string>;

  // Build configuration
  build?: {
    command?: string;
    outputDirectory?: string;
    installCommand?: string;
  };
}

/**
 * Deployment Result
 * Response from deployment API
 */
export interface DeployResult {
  success: boolean;
  jobId: string;
  deploymentId?: string;
  url?: string;
  logs?: string[];
  error?: string;
}

/**
 * Deployment Statistics
 */
export interface DeployStats {
  totalDeployments: number;
  successRate: number;
  averageDuration: number;
  lastDeployment?: Timestamp;
  deploymentsByTarget: Record<DeployTarget, number>;
  deploymentsByEnv: Record<DeployEnv, number>;
}

/**
 * Deployment Filter
 */
export interface DeployFilter {
  target?: DeployTarget;
  env?: DeployEnv;
  status?: DeployStatus;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * OAuth Token Configuration
 */
export interface OAuthTokens {
  firebase?: string;
  vercel?: string;
  github?: string;
}

/**
 * Deployment Provider Interface
 * Abstract interface for deployment providers
 */
export interface DeploymentProvider {
  name: DeployTarget;
  deploy(config: DeployConfig): Promise<DeployResult>;
  getStatus(deploymentId: string): Promise<DeployStatus>;
  getLogs(deploymentId: string): Promise<DeployLog[]>;
  cancel?(deploymentId: string): Promise<boolean>;
}

/**
 * Deployment Trigger Request
 */
export interface DeployTriggerRequest {
  target: DeployTarget;
  env: DeployEnv;
  config?: DeployConfig;
  userId: string;
}

/**
 * Deployment Status Response
 */
export interface DeployStatusResponse {
  jobId: string;
  status: DeployStatus;
  progress?: number; // 0-100
  currentStep?: string;
  logs: DeployLog[];
  resultUrl?: string;
  error?: string;
}
