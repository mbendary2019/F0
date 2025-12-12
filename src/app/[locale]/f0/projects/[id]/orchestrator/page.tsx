/**
 * Phase 92: Orchestrator Dashboard Page
 *
 * Real-time dashboard for monitoring project execution
 */

'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { OrchestratorDashboard } from '@/components/f0/orchestrator/OrchestratorDashboard';

export default function OrchestratorPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div className="h-full overflow-y-auto bg-[#050510] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Orchestrator Dashboard</h1>
          <p className="text-gray-400">
            Monitor real-time execution of your project phases and tasks
          </p>
        </div>

        <OrchestratorDashboard projectId={projectId} />
      </div>
    </div>
  );
}
