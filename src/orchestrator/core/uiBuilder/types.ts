// orchestrator/core/uiBuilder/types.ts
// =============================================================================
// Phase 163.1 – UI Builder Types
// Data models for UI generation from media
// =============================================================================

export type UiGenerationMode = 'page' | 'component' | 'dashboard' | 'form';

export type UiGenerationStatus =
  | 'pending'
  | 'analyzing'
  | 'generating'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'building'
  | 'completed'
  | 'failed';

// =============================================================================
// UI Generation Request
// =============================================================================

export interface UiGenerationRequest {
  id: string;
  projectId: string;
  attachmentIds: string[];         // Source media files
  mode: UiGenerationMode;
  targetPath?: string;             // e.g., "src/app/dashboard/page.tsx"
  framework?: 'nextjs' | 'react';
  styling?: 'tailwind' | 'shadcn' | 'plain';
  createdBy: string;
  createdAt: string;
  conversationId?: string;         // Link to chat context
  turnId?: string;                 // Specific turn that triggered this

  // Additional context from user
  instructions?: string;           // User's additional instructions
  constraints?: string[];          // e.g., ["use shadcn", "RTL support"]
}

// =============================================================================
// UI Component Node (Tree Structure)
// =============================================================================

export interface UiComponentNode {
  id: string;
  name: string;                    // e.g., "LoginForm", "Navbar"
  type: 'page' | 'layout' | 'component' | 'section' | 'element';
  description?: string;
  props?: Record<string, unknown>;
  children?: UiComponentNode[];

  // Code generation hints
  suggestedPath?: string;          // Where to create the file
  dependencies?: string[];         // npm packages needed
  imports?: string[];              // Import statements

  // Visual hints from media analysis
  visualHints?: {
    layout?: 'flex' | 'grid' | 'block';
    spacing?: 'tight' | 'normal' | 'loose';
    colors?: string[];
    typography?: string[];
  };
}

// =============================================================================
// UI Generation Proposal
// =============================================================================

export interface UiGenerationProposal {
  id: string;
  requestId: string;
  projectId: string;
  status: UiGenerationStatus;
  createdAt: string;
  updatedAt: string;

  // Analysis results
  analysisNotes?: string;          // What the agent understood from media
  componentTree: UiComponentNode[];

  // Mapping: componentId → file to create
  filePlan: UiFilePlan[];

  // Planner integration
  planId?: string;                 // If approved, the Plan that builds this
  taskIds?: string[];              // Tasks created from this proposal

  // Error handling
  errorMessage?: string;
}

export interface UiFilePlan {
  componentId: string;             // Links to UiComponentNode.id
  path: string;                    // e.g., "src/components/LoginForm.tsx"
  action: 'create' | 'modify';
  estimatedLines?: number;
  dependencies?: string[];
}

// =============================================================================
// UI Builder Store Interface
// =============================================================================

export interface UiBuilderStore {
  // Request operations
  createRequest(req: Omit<UiGenerationRequest, 'id' | 'createdAt'>): Promise<UiGenerationRequest>;
  getRequest(requestId: string): Promise<UiGenerationRequest | null>;
  listRequests(projectId: string, limit?: number): Promise<UiGenerationRequest[]>;

  // Proposal operations
  createProposal(proposal: Omit<UiGenerationProposal, 'id' | 'createdAt' | 'updatedAt'>): Promise<UiGenerationProposal>;
  getProposal(proposalId: string): Promise<UiGenerationProposal | null>;
  getProposalByRequest(requestId: string): Promise<UiGenerationProposal | null>;
  updateProposal(proposalId: string, updates: Partial<UiGenerationProposal>): Promise<void>;
  listProposals(projectId: string, status?: UiGenerationStatus): Promise<UiGenerationProposal[]>;

  // Approval workflow
  approveProposal(proposalId: string, planId: string): Promise<void>;
  rejectProposal(proposalId: string, reason?: string): Promise<void>;
}

console.log('[163.1][UI_BUILDER] Types loaded');
