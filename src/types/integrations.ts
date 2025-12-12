/**
 * Phase 70.2: Integrations Types
 * GitHub, Vercel, and Domain integrations
 */

export interface GitHubIntegrationData {
  connected: boolean;
  username?: string;
  repoName?: string;
  repoUrl?: string;
  branch?: string; // main / master
  lastSync?: string;
  // Phase 74: Auto Push tracking
  lastCommitSha?: string;
  lastCommitMessage?: string;
}

export interface VercelIntegrationData {
  connected: boolean;
  projectId?: string;
  projectName?: string;
  deploymentUrl?: string;
  lastDeploy?: string;
}

export interface DomainIntegrationData {
  provider: 'vercel' | 'godaddy';
  domain: string;
  subdomain: string;
  attached: boolean;
  dnsVerified?: boolean;
  lastCheck?: string;
}

/**
 * GitHub OAuth Device Flow Types
 */
export interface GitHubDeviceCodeResponse {
  user_code: string;
  device_code: string;
  verification_uri: string;
  expires_in: number;
  interval?: number;
}

export interface GitHubDevicePollRequest {
  device_code: string;
}

export interface GitHubDevicePollResponse {
  status: 'pending' | 'ok' | 'error';
  access_token?: string;
  error?: string;
}

/**
 * GitHub Repo Creation
 */
export interface CreateGitHubRepoRequest {
  projectId: string;
  repoName: string;
  token: string;
  isPrivate?: boolean;
}

export interface CreateGitHubRepoResponse {
  ok: boolean;
  repoUrl?: string;
  error?: string;
}

/**
 * Vercel Project Creation
 */
export interface CreateVercelProjectRequest {
  projectId: string;
  projectName: string;
  githubRepo: string; // format: "username/repo"
}

export interface CreateVercelProjectResponse {
  ok: boolean;
  vercelProjectId?: string;
  error?: string;
}

/**
 * GoDaddy DNS Update
 */
export interface UpdateGoDaddyDNSRequest {
  projectId: string;
  domain: string;
  subdomain: string;
  target: string; // IP address or CNAME target
}

export interface UpdateGoDaddyDNSResponse {
  ok: boolean;
  error?: string;
}
