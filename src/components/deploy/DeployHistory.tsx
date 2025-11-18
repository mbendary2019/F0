'use client';

import {useEffect, useState} from 'react';
import {functions} from '@/lib/firebaseClient';
import {httpsCallable} from 'firebase/functions';
import {useTranslations} from 'next-intl';
import {formatDistanceToNow} from 'date-fns';
import {ar, enUS} from 'date-fns/locale';
import {useLocale} from 'next-intl';
import type {DeployStatus} from '@/types/deploy';

interface DeployHistoryProps {
  onJobSelect?: (jobId: string) => void;
}

interface DeployJob {
  id: string;
  target: string;
  env: string;
  status: DeployStatus;
  createdAt: {toMillis: () => number};
  endTime?: {toMillis: () => number};
  resultUrl?: string;
}

export function DeployHistory({onJobSelect}: DeployHistoryProps) {
  const t = useTranslations('ops.deploy.history');
  const locale = useLocale();
  const [jobs, setJobs] = useState<DeployJob[]>([]);
  const [loading, setLoading] = useState(true);

  const dateLocale = locale === 'ar' ? ar : enUS;

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const getDeployHistory = httpsCallable(functions, 'getDeployHistory');
      const result = await getDeployHistory({limit: 20});
      const data = result.data as any;

      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: DeployStatus) => {
    const colors = {
      queued: 'bg-yellow-100 text-yellow-800',
      deploying: 'bg-blue-100 text-blue-800',
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status] || colors.queued}`}>
        {t(`status.${status}`)}
      </span>
    );
  };

  const formatDuration = (job: DeployJob) => {
    if (!job.endTime) return 'N/A';
    const ms = job.endTime.toMillis() - job.createdAt.toMillis();
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">{t('title')}</h3>
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{t('title')}</h3>
        <button
          onClick={loadHistory}
          className="text-sm text-primary hover:text-primary/80"
        >
          {t('refresh')}
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t('noDeployments')}
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => onJobSelect?.(job.id)}
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{job.target}</span>
                    <span className="text-xs text-muted-foreground">({job.env})</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(job.createdAt.toMillis(), {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                    {' • '}
                    {formatDuration(job)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getStatusBadge(job.status)}
                {job.resultUrl && (
                  <a
                    href={job.resultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:text-primary/80"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
