export type Project = {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  createdAt: string;       // ISO
  lastActivityAt: string;  // ISO
  tasksCount: number;
};
