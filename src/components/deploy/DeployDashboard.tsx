'use client';

import {useState} from 'react';
import {DeployButton} from './DeployButton';
import {EnvSelector} from './EnvSelector';
import {DeployStatusCard} from './DeployStatusCard';
import {DeployLogs} from './DeployLogs';
import {DeployHistory} from './DeployHistory';
import type {DeployTarget, DeployEnv} from '@/types/deploy';

export function DeployDashboard() {
  const [selectedTarget, setSelectedTarget] = useState<DeployTarget>('firebase');
  const [selectedEnv, setSelectedEnv] = useState<DeployEnv>('production');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const handleDeployStart = (jobId: string) => {
    setActiveJobId(jobId);
  };

  return (
    <div className="space-y-6">
      {/* Deployment Controls */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">New Deployment</h2>

        <div className="space-y-4">
          {/* Target Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Deployment Target
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setSelectedTarget('firebase')}
                className={`flex-1 rounded-lg border-2 p-4 text-center transition-all ${
                  selectedTarget === 'firebase'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-lg font-semibold">Firebase</div>
                <div className="text-xs text-muted-foreground mt-1">Hosting + Functions</div>
              </button>

              <button
                onClick={() => setSelectedTarget('vercel')}
                className={`flex-1 rounded-lg border-2 p-4 text-center transition-all ${
                  selectedTarget === 'vercel'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-lg font-semibold">Vercel</div>
                <div className="text-xs text-muted-foreground mt-1">Edge Deployment</div>
              </button>

              <button
                onClick={() => setSelectedTarget('github-pages')}
                className={`flex-1 rounded-lg border-2 p-4 text-center transition-all ${
                  selectedTarget === 'github-pages'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-lg font-semibold">GitHub Pages</div>
                <div className="text-xs text-muted-foreground mt-1">Static Hosting</div>
              </button>
            </div>
          </div>

          {/* Environment Selection */}
          <EnvSelector selectedEnv={selectedEnv} onEnvChange={setSelectedEnv} />

          {/* Deploy Button */}
          <DeployButton
            target={selectedTarget}
            env={selectedEnv}
            onDeployStart={handleDeployStart}
          />
        </div>
      </div>

      {/* Active Deployment Status */}
      {activeJobId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DeployStatusCard jobId={activeJobId} />
          <DeployLogs jobId={activeJobId} />
        </div>
      )}

      {/* Deployment History */}
      <DeployHistory onJobSelect={setActiveJobId} />
    </div>
  );
}
