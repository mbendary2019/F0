'use client';

import type { OpsDeployment } from '@/types/ops';

interface Props {
  open: boolean;
  onClose: () => void;
  deployment: OpsDeployment;
}

function formatDate(value?: number | null) {
  if (!value) return '—';
  try {
    const date = new Date(value);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function DeploymentDetailsDrawer({
  open,
  onClose,
  deployment,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="w-full max-w-md bg-[#07041A] border-l border-white/10 p-6 overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {deployment.projectName}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Branch <span className="font-mono">{deployment.branch}</span> ·{' '}
              <span className="capitalize">{deployment.env}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm"
          >
            Close ✕
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Status">
              <span
                className={`px-2 py-1 rounded-full text-xs capitalize ${
                  deployment.status === 'success'
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : deployment.status === 'failed'
                    ? 'bg-rose-500/20 text-rose-200'
                    : deployment.status === 'in_progress'
                    ? 'bg-blue-500/20 text-blue-200'
                    : 'bg-slate-700/60 text-slate-200'
                }`}
              >
                {deployment.status}
              </span>
            </Info>
            <Info label="Provider">
              <span className="capitalize">{deployment.provider}</span>
            </Info>
            <Info label="Project ID">
              <code className="text-[11px] break-all opacity-80">
                {deployment.projectId}
              </code>
            </Info>
            <Info label="Owner UID">
              <code className="text-[11px] break-all opacity-80">
                {deployment.ownerUid}
              </code>
            </Info>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Info label="Label">
              <span className="text-sm">{deployment.label || '—'}</span>
            </Info>
            <Info label="Created at">
              {formatDate(deployment.createdAt)}
            </Info>
            <Info label="Finished at">
              {formatDate(deployment.finishedAt)}
            </Info>
          </div>

          <div className="space-y-3">
            {deployment.url && (
              <Info label="Deployed URL">
                <a
                  href={deployment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-pink-400 hover:text-pink-300 underline break-all"
                >
                  {deployment.url}
                </a>
              </Info>
            )}

            {deployment.logsUrl && (
              <Info label="Build logs">
                <a
                  href={deployment.logsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-pink-400 hover:text-pink-300 underline break-all"
                >
                  Open logs
                </a>
              </Info>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-sm text-white/90">{children}</span>
    </div>
  );
}
