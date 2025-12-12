// src/types/liveSession.ts
export type LiveSessionStatus = 'active' | 'ended';

export interface LiveSession {
  id: string;
  ownerUid: string;
  projectId: string;
  projectName?: string;
  status: LiveSessionStatus;
  createdAt: Date;
  endedAt?: Date | null;
}

export type LiveSessionEventType =
  | 'system'
  | 'agent'
  | 'user'
  | 'deploy'
  | 'patch';

export interface LiveSessionEvent {
  id: string;
  ownerUid: string;
  sessionId: string;
  type: LiveSessionEventType;
  message: string;
  createdAt: Date;
  meta?: Record<string, any>;
}
