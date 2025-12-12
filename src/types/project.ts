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

/**
 * Phase 79: Project Types
 * Unified project structure with ownerUid
 * Phase 99: Extended with projectType, platforms, framework
 * Phase 100.2: Added brand media assets (logo, splash, hero)
 * Phase 100.2 Improved: Nested branding object for better organization
 */
export type ProjectStatus = 'active' | 'archived' | 'draft';

export type ProjectType = 'web-app' | 'mobile-app' | 'desktop-app' | 'backend-api' | 'mixed';

export type Platform = 'ios' | 'android' | 'web' | 'windows' | 'mac' | 'linux';

export type Framework = 'nextjs' | 'react-native' | 'electron' | 'tauri' | 'node-api' | 'other';

export interface F0Project {
  id: string;
  ownerUid: string;
  name: string;
  shortDescription?: string;
  techStack?: string; // e.g. "Next.js, Firebase, Tailwind"
  createdAt: string;  // ISO format on API side
  updatedAt: string;
  status: ProjectStatus;

  // Phase 99: Project-aware agent fields
  projectType?: ProjectType;
  platforms?: Platform[];
  framework?: Framework;

  // Optional infra metadata
  usesFirebase?: boolean;
  usesStripe?: boolean;
  usesVercel?: boolean;

  // Phase 100.2 Improved: Brand media assets from AI Media Studio (nested structure)
  branding?: {
    logoUrl?: string;        // Logo (navbar, sidebar, etc.)
    splashUrl?: string;      // Splash screen
    heroUrl?: string;        // Landing page hero image
    appIconUrl?: string;     // App icon
    backgroundUrl?: string;  // Background image
  };

  // Legacy fields (kept for backward compatibility - will be migrated)
  brandLogoUrl?: string;
  brandSplashUrl?: string;
  brandHeroUrl?: string;
  brandAppIconUrl?: string;
  brandBackgroundUrl?: string;

  // Phase 97.1: Preview URL for Device Preview Pane
  previewUrl?: string; // e.g. "http://localhost:3001" or "https://myapp.vercel.app"
}

export interface CreateProjectRequest {
  name: string;
  shortDescription?: string;
  techStack?: string;
}

export interface ListProjectsResponse {
  projects: F0Project[];
}

/**
 * Phase 98: Project context for Agent
 */
export interface ProjectContext {
  name: string;
  appTypes: string[];  // ['web', 'mobile', 'desktop']
  mobileTargets?: string[];  // ['ios', 'android']
  desktopTargets?: string[];  // ['mac', 'windows', 'linux']
  infraType: string;  // 'firebase' | 'supabase' | 'custom'
}

/**
 * Phase 98: Agent message stored in Firestore
 */
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  lang?: 'ar' | 'en';
  metadata?: {
    mode?: 'CONVERSATIONAL' | 'ARCHITECT';
    hasArchitectPlan?: boolean;
  };
}

/**
 * Phase 99: Agent Session per Project
 * Stores session metadata linking agent conversations to projects
 */
export interface AgentSession {
  id: string;
  projectId: string;
  createdAt: number;
  lastMessageAt: number;

  // Snapshot of project context at session start
  projectSnapshot?: {
    projectType?: ProjectType;
    platforms?: Platform[];
    framework?: Framework;
    name?: string;
  };
}

/**
 * Phase 103: F0 Project Phase (from Agent JSON output)
 */
export interface F0Phase {
  id: string;
  title: string;
  goals: string[];
  features: string[];
  risks?: string[];
  order: number;
  status: 'pending' | 'active' | 'completed';
  createdAt: number;
  updatedAt: number;
}

/**
 * Phase 103: F0 Project Task (generated from phase features)
 */
export interface F0Task {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort: 'small' | 'medium' | 'large';
  assignedTo?: string; // Agent ID or 'code-agent'
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

/**
 * Phase 104.4: Queued Action (from next_actions in F0_JSON)
 * Updated with projectId, phaseId, taskId for better tracking
 */
export type F0ActionStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface F0QueuedAction {
  id?: string;
  projectId: string;
  type: 'preflight' | 'execute_task';
  phaseId?: string;
  taskId?: string;
  taskTitle?: string;
  status: F0ActionStatus;
  createdAt: number;
  startedAt?: number | null;
  completedAt?: number | null;
  lastError?: string | null;
}

/**
 * Phase 103: Project Memory (from Agent JSON output)
 */
export interface F0ProjectMemory {
  summary: string;
  target_users: string[];
  platforms: string[];
  clarity_score: number;
  assumptions: {
    frontend?: string;
    backend?: string;
    db?: string;
    auth?: string;
    payments?: string;
    realtime_data?: string;
  };
  lastUpdated: number;
}
