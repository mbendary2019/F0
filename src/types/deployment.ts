export type DeploymentEnv = 'production' | 'preview';
export type DeploymentStatus = 'success' | 'failed' | 'in_progress';

export interface F0Deployment {
  id: string;
  ownerUid: string;
  projectId: string;
  projectName: string;

  env: DeploymentEnv;          // production | preview
  status: DeploymentStatus;    // success | failed | in_progress

  branch: string;              // main, dev...
  label?: string;              // "feat: Add user authentication"

  provider: 'vercel' | 'github-actions' | 'other';

  url?: string;                // رابط Visit site
  logsUrl?: string;            // رابط View logs

  createdAt: number;           // timestamp (ms)
  finishedAt?: number | null;  // لو لسه شغّال تكون null
}
