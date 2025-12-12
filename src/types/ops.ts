// src/types/ops.ts
export type OpsDeploymentEnv = 'production' | 'preview' | 'development';

export type OpsDeploymentStatus =
  | 'success'
  | 'in_progress'
  | 'failed'
  | 'queued';

export type OpsDeploymentProvider = 'vercel' | 'github-actions';

export interface OpsDeployment {
  id: string;
  projectId: string;
  projectName: string;
  ownerUid: string;

  env: OpsDeploymentEnv;
  status: OpsDeploymentStatus;
  provider: OpsDeploymentProvider;

  branch: string;
  label: string;

  url?: string | null;      // Visit site
  logsUrl?: string | null;  // View logs (Vercel / GitHub)

  createdAt: number;        // timestamp ms
  finishedAt?: number | null;
}
