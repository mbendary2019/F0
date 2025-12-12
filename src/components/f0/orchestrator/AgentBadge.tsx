/**
 * Phase 92: Agent Badge Component
 *
 * Displays agent type with color-coded badge and icon
 */

import React from 'react';

type AgentType = 'UI_AGENT' | 'DB_AGENT' | 'IDE_AGENT' | 'BACKEND_AGENT' | 'DEPLOY_AGENT';

interface AgentBadgeProps {
  agent?: AgentType;  // Made optional for new task format
  className?: string;
}

const AGENT_CONFIG: Record<string, { label: string; icon: string; className: string }> = {
  UI_AGENT: {
    label: 'UI',
    icon: '🎨',
    className: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  },
  DB_AGENT: {
    label: 'DB',
    icon: '🗄️',
    className: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  },
  BACKEND_AGENT: {
    label: 'Backend',
    icon: '⚙️',
    className: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  },
  IDE_AGENT: {
    label: 'IDE',
    icon: '🛠️',
    className: 'bg-green-500/20 text-green-300 border border-green-500/30',
  },
  DEPLOY_AGENT: {
    label: 'Deploy',
    icon: '🚀',
    className: 'bg-pink-500/20 text-pink-300 border border-pink-500/30',
  },
};

export function AgentBadge({ agent, className = '' }: AgentBadgeProps) {
  // Return nothing if no agent specified (new task format)
  if (!agent) return null;

  const config = AGENT_CONFIG[agent] || AGENT_CONFIG.BACKEND_AGENT;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className} ${className}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
