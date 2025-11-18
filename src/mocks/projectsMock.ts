import type { Project } from '@/features/projects/types';

export const mockProjects: Project[] = [
  {
    id: 'p1',
    name: 'CashoutSwap Platform',
    status: 'active',
    createdAt: '2025-01-10T10:00:00Z',
    lastActivityAt: '2025-11-10T18:30:00Z',
    tasksCount: 24,
  },
  {
    id: 'p2',
    name: 'Mahallak Online',
    status: 'active',
    createdAt: '2025-02-05T09:00:00Z',
    lastActivityAt: '2025-11-09T14:15:00Z',
    tasksCount: 13,
  },
  {
    id: 'p3',
    name: 'F0 Neon UI Revamp',
    status: 'paused',
    createdAt: '2025-03-20T12:00:00Z',
    lastActivityAt: '2025-11-01T11:00:00Z',
    tasksCount: 7,
  },
];
