/**
 * Phase 92: Task Status Pill Component
 *
 * Displays task status with color-coded badge
 * Supports both legacy (NEW/IN_PROGRESS/DONE/FAILED) and new (pending/in_progress/completed/blocked) status formats
 */

import React from 'react';

// Support both legacy and new status formats
type TaskStatus =
  | 'NEW' | 'IN_PROGRESS' | 'DONE' | 'FAILED'  // Legacy
  | 'pending' | 'in_progress' | 'completed' | 'blocked' | 'active';  // New

interface TaskStatusPillProps {
  status: TaskStatus;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Legacy statuses
  NEW: {
    label: 'New',
    className: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  },
  DONE: {
    label: 'Done',
    className: 'bg-green-500/20 text-green-300 border border-green-500/30',
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-red-500/20 text-red-300 border border-red-500/30',
  },
  // New statuses (stable IDs)
  pending: {
    label: 'Pending',
    className: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-500/20 text-green-300 border border-green-500/30',
  },
  blocked: {
    label: 'Blocked',
    className: 'bg-red-500/20 text-red-300 border border-red-500/30',
  },
  active: {
    label: 'Active',
    className: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  },
};

export function TaskStatusPill({ status, className = '' }: TaskStatusPillProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}
