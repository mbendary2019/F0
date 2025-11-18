'use client';

import {useEffect, useState, useRef} from 'react';
import {db} from '@/lib/firebaseClient';
import {doc, onSnapshot} from 'firebase/firestore';
import {useTranslations} from 'next-intl';
import {formatDistanceToNow} from 'date-fns';
import {ar, enUS} from 'date-fns/locale';
import {useLocale} from 'next-intl';

interface DeployLogsProps {
  jobId: string;
}

interface LogEntry {
  timestamp: {toDate: () => Date};
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  metadata?: Record<string, any>;
}

export function DeployLogs({jobId}: DeployLogsProps) {
  const t = useTranslations('ops.deploy.logs');
  const locale = useLocale();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const dateLocale = locale === 'ar' ? ar : enUS;

  useEffect(() => {
    // Real-time listener for deployment logs
    const unsubscribe = onSnapshot(
      doc(db, 'ops_deploy_jobs', jobId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setLogs(data.logs || []);
        }
      },
      (error) => {
        console.error('Error listening to logs:', error);
      }
    );

    return () => unsubscribe();
  }, [jobId]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info':
        return 'text-blue-600';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      case 'success':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'success':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{t('title')}</h3>
        <div className="text-xs text-muted-foreground">
          {logs.length} {t('entries')}
        </div>
      </div>

      {/* Logs Container */}
      <div className="h-96 overflow-y-auto rounded-lg bg-gray-900 p-4 font-mono text-xs">
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            {t('noLogs')}
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-gray-500">
                  [{log.timestamp?.toDate ? formatDistanceToNow(log.timestamp.toDate(), {locale: dateLocale, addSuffix: true}) : 'now'}]
                </span>
                <span className={getLevelColor(log.level)}>{getLevelIcon(log.level)}</span>
                <span className="flex-1 text-gray-300">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Export Logs Button */}
      <button
        onClick={() => {
          const logText = logs
            .map(
              (log) =>
                `[${log.timestamp?.toDate ? log.timestamp.toDate().toISOString() : 'now'}] [${log.level.toUpperCase()}] ${log.message}`
            )
            .join('\n');

          const blob = new Blob([logText], {type: 'text/plain'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `deploy-${jobId}-logs.txt`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        className="mt-4 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        {t('exportLogs')}
      </button>
    </div>
  );
}
