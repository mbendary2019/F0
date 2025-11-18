'use client';

import {useState} from 'react';
import {functions} from '@/lib/firebaseClient';
import {httpsCallable} from 'firebase/functions';
import {useTranslations} from 'next-intl';
import type {DeployTarget, DeployEnv} from '@/types/deploy';

interface DeployButtonProps {
  target: DeployTarget;
  env: DeployEnv;
  onDeployStart?: (jobId: string) => void;
}

export function DeployButton({target, env, onDeployStart}: DeployButtonProps) {
  const t = useTranslations('ops.deploy');
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeploy = async () => {
    setDeploying(true);
    setError(null);

    try {
      const triggerDeploy = httpsCallable(functions, 'triggerDeploy');

      const result = await triggerDeploy({
        target,
        env,
      });

      const data = result.data as any;

      if (data.success && data.jobId) {
        onDeployStart?.(data.jobId);
      } else {
        throw new Error('Deployment failed to start');
      }
    } catch (err: any) {
      console.error('Deployment error:', err);
      setError(err.message || 'Failed to start deployment');
    } finally {
      setDeploying(false);
    }
  };

  const getTargetLabel = () => {
    switch (target) {
      case 'firebase':
        return 'Firebase';
      case 'vercel':
        return 'Vercel';
      case 'github-pages':
        return 'GitHub Pages';
      default:
        return target;
    }
  };

  const getEnvLabel = () => {
    switch (env) {
      case 'production':
        return t('env.production');
      case 'staging':
        return t('env.staging');
      case 'preview':
        return t('env.preview');
      case 'custom':
        return t('env.custom');
      default:
        return env;
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleDeploy}
        disabled={deploying}
        className="w-full rounded-lg bg-primary px-6 py-4 text-lg font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        {deploying ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            <span>{t('deploying')}</span>
          </>
        ) : (
          <>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span>
              {t('deployNow')} — {getTargetLabel()} ({getEnvLabel()})
            </span>
          </>
        )}
      </button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Deployment Info */}
      <div className="text-xs text-muted-foreground">
        <p>
          {t('info.target')}: <span className="font-medium">{getTargetLabel()}</span>
        </p>
        <p>
          {t('info.environment')}: <span className="font-medium">{getEnvLabel()}</span>
        </p>
      </div>
    </div>
  );
}
