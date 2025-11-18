import { Timestamp } from 'firebase/firestore';

/**
 * GitHub OAuth Scopes
 */
export type GitHubScope = 'repo' | 'user:email' | 'workflow' | 'read:user' | 'admin:repo_hook';

/**
 * GitHub Event Types (Webhooks)
 */
export type GitHubEventType =
  | 'push'
  | 'pull_request'
  | 'create'
  | 'delete'
  | 'issues'
  | 'fork'
  | 'star'
  | 'watch';

/**
 * Sync Mode for Repository Operations
 */
export type SyncMode = 'push' | 'pull' | 'pr' | 'both';

/**
 * Sync Status
 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'conflict' | 'error';

/**
 * GitHub Account Interface
 * Represents a connected GitHub account
 */
export interface GitHubAccount {
  id: string;
  userId: string;

  // GitHub user info
  githubId: number;
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;

  // OAuth info
  scopes: GitHubScope[];
  tokenEncrypted: string; // Encrypted access token

  // Metadata
  connectedAt: Timestamp;
  lastSyncAt?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * GitHub Repository Interface
 * Represents a connected repository
 */
export interface GitHubRepository {
  id: string;
  userId: string;
  accountId: string; // Reference to GitHubAccount

  // Repository info
  repoId: number;
  fullName: string; // e.g., "owner/repo"
  name: string;
  owner: string;
  description?: string;

  // Branch info
  defaultBranch: string;
  currentBranch?: string;

  // Permissions
  permissions: {
    pull: boolean;
    push: boolean;
    admin: boolean;
  };

  // Sync settings
  syncEnabled: boolean;
  autoSync: boolean; // Auto-sync on file changes
  syncMode: SyncMode;

  // Status
  lastSyncAt?: Timestamp;
  lastSyncStatus?: SyncStatus;
  lastSyncCommit?: string;

  // URLs
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;

  // Metadata
  private: boolean;
  fork: boolean;
  archived: boolean;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * GitHub Activity Interface
 * Represents a GitHub event/activity
 */
export interface GitHubActivity {
  id: string;
  userId: string;
  repoId: number;
  repoFullName: string;

  // Event details
  type: GitHubEventType;
  action?: string; // e.g., "opened", "closed", "merged"

  // Commit/PR info
  branch?: string;
  commit?: string;
  commitMessage?: string;
  prNumber?: number;
  prTitle?: string;

  // Actor
  actor: string; // GitHub username
  actorAvatarUrl?: string;

  // Content
  payload: Record<string, any>; // Raw GitHub webhook payload

  // Timestamps
  timestamp: Timestamp;
  createdAt: Timestamp;
}

/**
 * Sync Job Interface
 * Represents a sync operation
 */
export interface SyncJob {
  id: string;
  userId: string;
  repoId: number;
  repoFullName: string;

  // Sync configuration
  mode: SyncMode;
  sourceBranch?: string;
  targetBranch?: string;

  // Status
  status: SyncStatus;
  progress?: number; // 0-100

  // Results
  filesChanged?: number;
  additions?: number;
  deletions?: number;
  commitSha?: string;
  prUrl?: string;

  // Logs
  logs: SyncLog[];

  // Error tracking
  errorMessage?: string;
  errorStack?: string;

  // Conflict resolution
  conflicts?: ConflictInfo[];

  // Timestamps
  startedAt: Timestamp;
  completedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Sync Log Entry
 */
export interface SyncLog {
  timestamp: Timestamp;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Conflict Information
 */
export interface ConflictInfo {
  filePath: string;
  localContent: string;
  remoteContent: string;
  resolved: boolean;
  resolution?: 'local' | 'remote' | 'manual';
}

/**
 * OAuth State Interface
 * For OAuth flow security
 */
export interface OAuthState {
  userId: string;
  returnUrl?: string;
  timestamp: number;
  nonce: string;
}

/**
 * GitHub API Responses
 */

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  bio?: string;
  company?: string;
  location?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string;
  private: boolean;
  fork: boolean;
  default_branch: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  permissions: {
    pull: boolean;
    push: boolean;
    admin: boolean;
  };
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  merged: boolean;
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Webhook Payload Interfaces
 */

export interface WebhookPayload {
  action?: string;
  repository: GitHubRepo;
  sender: {
    login: string;
    avatar_url: string;
  };
}

export interface PushWebhookPayload extends WebhookPayload {
  ref: string; // refs/heads/main
  before: string;
  after: string;
  commits: GitHubCommit[];
  pusher: {
    name: string;
    email: string;
  };
}

export interface PullRequestWebhookPayload extends WebhookPayload {
  pull_request: GitHubPullRequest;
}

/**
 * Sync Configuration
 */
export interface SyncConfig {
  mode: SyncMode;
  branch?: string;
  message?: string;
  createPr?: boolean;
  prTitle?: string;
  prBody?: string;
  autoMerge?: boolean;
}

/**
 * Repository Stats
 */
export interface RepoStats {
  totalCommits: number;
  totalPRs: number;
  openIssues: number;
  stars: number;
  forks: number;
  lastActivity?: Timestamp;
}

/**
 * GitHub Integration Settings
 */
export interface GitHubSettings {
  userId: string;

  // Auto-sync settings
  autoSyncEnabled: boolean;
  autoSyncInterval: number; // minutes

  // Notification settings
  notifyOnPush: boolean;
  notifyOnPR: boolean;
  notifyOnIssues: boolean;

  // Conflict handling
  conflictResolution: 'manual' | 'auto-local' | 'auto-remote';

  // Webhook settings
  webhookSecret?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
