// src/components/quality/LLMModelsPanel.tsx
// Phase 170: LLM Models Overview Panel
'use client';

import React, { useState, useEffect } from 'react';

interface ModelInfo {
  provider: string;
  model: string;
  label: string;
  latencyMs: number | null;
  cost: string;
  status: 'active' | 'available' | 'unavailable';
  bestFor: string[];
  tier: 'cheap' | 'medium' | 'expensive';
}

const MODELS: ModelInfo[] = [
  {
    provider: 'Mistral',
    model: 'mistral-small-latest',
    label: 'Mistral Small',
    latencyMs: 731,
    cost: '$0.10/1K',
    status: 'active',
    bestFor: ['Chat', 'Planning', 'Quick Tasks'],
    tier: 'cheap',
  },
  {
    provider: 'DevStral',
    model: 'devstral-small-2505',
    label: 'DevStral Small',
    latencyMs: 574,
    cost: '$0.10/1K',
    status: 'active',
    bestFor: ['Auto-Fix', 'Code Generation', 'Refactoring'],
    tier: 'cheap',
  },
  {
    provider: 'DevStral',
    model: 'codestral-latest',
    label: 'Codestral',
    latencyMs: null,
    cost: '$0.30/1K',
    status: 'available',
    bestFor: ['Complex Code', 'Code Review', 'Long Context'],
    tier: 'medium',
  },
  {
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    latencyMs: 1351,
    cost: '$0.15/1K',
    status: 'active',
    bestFor: ['General Chat', 'Multimodal', 'Simple Code'],
    tier: 'cheap',
  },
  {
    provider: 'OpenAI',
    model: 'gpt-4o',
    label: 'GPT-4o',
    latencyMs: null,
    cost: '$2.50/1K',
    status: 'available',
    bestFor: ['Complex Tasks', 'Quality Critical', 'Multimodal'],
    tier: 'expensive',
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-haiku-20240307',
    label: 'Claude 3 Haiku',
    latencyMs: null,
    cost: '$0.25/1K',
    status: 'available',
    bestFor: ['Chat', 'Quick Tasks', 'Summarization'],
    tier: 'cheap',
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-5-sonnet-20241022',
    label: 'Claude 3.5 Sonnet',
    latencyMs: null,
    cost: '$3.00/1K',
    status: 'available',
    bestFor: ['Code Review', 'Refactoring', 'Long Documents'],
    tier: 'medium',
  },
  {
    provider: 'Anthropic',
    model: 'claude-3-opus-20240229',
    label: 'Claude 3 Opus',
    latencyMs: null,
    cost: '$15.00/1K',
    status: 'available',
    bestFor: ['Complex Analysis', 'Research', 'Quality Critical'],
    tier: 'expensive',
  },
];

const tierColors = {
  cheap: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  expensive: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const statusIcons = {
  active: '🟢',
  available: '🟡',
  unavailable: '🔴',
};

const statusLabels = {
  active: 'Active',
  available: 'Available',
  unavailable: 'No API Key',
};

export function LLMModelsPanel() {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const tasks = [
    'Auto-Fix',
    'Code Review',
    'Chat',
    'Planning',
    'Code Generation',
  ];

  const filteredModels = selectedTask
    ? MODELS.filter((m) => m.bestFor.includes(selectedTask))
    : MODELS;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Multi-Model Orchestrator
          </h3>
          <p className="text-sm text-white/60">
            Smart routing across {MODELS.length} models from {new Set(MODELS.map(m => m.provider)).size} providers
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span>🟢</span> Active
          </span>
          <span className="flex items-center gap-1">
            <span>🟡</span> Available
          </span>
          <span className="flex items-center gap-1">
            <span>🔴</span> Missing Key
          </span>
        </div>
      </div>

      {/* Task Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedTask(null)}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            selectedTask === null
              ? 'bg-blue-500 text-white'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          All Models
        </button>
        {tasks.map((task) => (
          <button
            key={task}
            onClick={() => setSelectedTask(task)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              selectedTask === task
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {task}
          </button>
        ))}
      </div>

      {/* Models Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredModels.map((m) => (
          <div
            key={m.model}
            className={`rounded-xl border bg-white/5 p-4 transition-all hover:bg-white/10 ${
              m.status === 'active'
                ? 'border-green-500/30'
                : m.status === 'available'
                ? 'border-yellow-500/30'
                : 'border-white/10 opacity-60'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-white/50">
                  {m.provider}
                </div>
                <div className="font-medium text-white">{m.label}</div>
                <div className="font-mono text-xs text-white/40">{m.model}</div>
              </div>
              <div className="text-xl" title={statusLabels[m.status]}>
                {statusIcons[m.status]}
              </div>
            </div>

            {/* Stats */}
            <div className="mt-3 flex items-center gap-3 text-xs">
              {m.latencyMs && (
                <span className="rounded bg-white/10 px-2 py-1">
                  ⚡ {m.latencyMs}ms
                </span>
              )}
              <span className={`rounded border px-2 py-1 ${tierColors[m.tier]}`}>
                {m.cost}
              </span>
            </div>

            {/* Best For */}
            <div className="mt-3">
              <div className="text-xs text-white/50">Best for:</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {m.bestFor.map((task) => (
                  <span
                    key={task}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      selectedTask === task
                        ? 'bg-blue-500/30 text-blue-300'
                        : 'bg-white/10 text-white/70'
                    }`}
                  >
                    {task}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">💡</span>
          <span className="text-white/80">
            <strong className="text-white">Routing Logic:</strong>{' '}
            {selectedTask === 'Auto-Fix' || selectedTask === 'Code Generation'
              ? 'DevStral is prioritized for code tasks (fast + specialized)'
              : selectedTask === 'Chat' || selectedTask === 'Planning'
              ? 'Mistral Small is prioritized (cheap + fast)'
              : 'Models are selected based on task type, user tier, and cost optimization'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default LLMModelsPanel;
