export type PhaseStatus = 'open' | 'in_progress' | 'done' | 'blocked';

export interface Phase {
  id: string;
  title: string;
  order: number;
  status: PhaseStatus;
  progress: number; // 0..100
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  phaseId: string;
  title: string;
  desc?: string;
  status: 'open' | 'in_progress' | 'done' | 'blocked';
  assigneeUid?: string;
  createdAt: number;
  updatedAt: number;
  source?: 'agent' | 'user';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: number;
  meta?: Record<string, any>;
}
