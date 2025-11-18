'use client';

import {useEffect, useState} from 'react';
import {functions} from '@/lib/firebaseClient';
import {httpsCallable} from 'firebase/functions';
import {useTranslations} from 'next-intl';
import type {DeployStatus} from '@/types/deploy';

interface DeployStatusCardProps {
  jobId: string;
}

interface StatusData {
  status: DeployStatus;
  progress: number;
  resultUrl?: string;
  errorMessage?: string;
  duration?: number;
}

export function DeployStatusCard({jobId}: DeployStatusCardProps) {
  const t = useTranslations('ops.deploy.status');
  const [statusData, setStatusData] = useState<StatusData>({
    status: 'queued',
    progress: 0,
  });
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const pollDeployStatus = httpsCallable(functions, 'pollDeployStatus');
        const result = await pollDeployStatus({jobId});
        const data = result.data as any;

        setStatusData({
          status: data.status,
          progress: data.progress,
          resultUrl: data.resultUrl,
          errorMessage: data.errorMessage,
          duration: data.duration,
        });

        // Stop polling if deployment is complete
        if (data.status === 'success' || data.status === 'failed' || data.status === 'cancelled') {
          setPolling(false);
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    };

    // Initial poll
    pollStatus();

    // Poll every 3 seconds if still deploying
    if (polling) {
      interval = setInterval(pollStatus, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId, polling]);

  const getStatusColor = () => {
    switch (statusData.status) {
      case 'queued':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'deploying':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (statusData.status) {
      case 'queued':
        return (
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'deploying':
        return (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-800"></div>
        );
      case 'success':
        return (
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">{t('title')}</h3>

      {/* Status Badge */}
      <div className={`mb-6 rounded-lg border-2 p-6 text-center ${getStatusColor()}`}>
        <div className="flex items-center justify-center mb-3">{getStatusIcon()}</div>
        <div className="text-2xl font-bold">{t(statusData.status)}</div>
        <div className="text-sm mt-1">{t('jobId')}: {jobId.slice(0, 8)}...</div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">{t('progress')}</span>
          <span className="font-medium">{statusData.progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{width: `${statusData.progress}%`}}
          />
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-2 text-sm">
        {statusData.duration !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('duration')}:</span>
            <span className="font-medium">{formatDuration(statusData.duration)}</span>
          </div>
        )}

        {statusData.resultUrl && (
          <div className="mt-4">
            <a
              href={statusData.resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-lg bg-primary px-4 py-2 text-center text-white hover:bg-primary/90"
            >
              {t('viewDeployment')} →
            </a>
          </div>
        )}

        {statusData.errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-800">{statusData.errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
