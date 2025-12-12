// src/lib/agent/actions/actionTypes.ts

/**
 * High-level category for an action.
 * Useful later for filtering, analytics, permissions, etc.
 */
export type ActionCategory =
  | 'FILE_SYSTEM'
  | 'FIRESTORE'
  | 'ENV'
  | 'DEPLOYMENT'
  | 'MEMORY'
  | 'TOOL'
  | 'OTHER';

/**
 * Supported action names (MVP set for Phase 95).
 * IMPORTANT: Stable string values – they'll be stored in Firestore / logs.
 */
export type ActionName =
  // File system / code actions
  | 'WRITE_FILE'
  | 'UPDATE_FILE'
  | 'DELETE_FILE'
  | 'MKDIR'
  // Firestore actions
  | 'CREATE_FIRESTORE_DOC'
  | 'UPDATE_FIRESTORE_DOC'
  | 'DELETE_FIRESTORE_DOC'
  // Env / config
  | 'UPDATE_ENV'
  // Deployments
  | 'RUN_DEPLOY'
  // Memory (bridge مع Phase 94)
  | 'APPEND_MEMORY_NOTE'
  | 'SET_MEMORY_SECTION'
  // Generic tool call (for future multi-agent tools)
  | 'CALL_TOOL';

/**
 * Execution status for an action within a plan.
 */
export type ActionStatus =
  | 'PENDING'   // Planned but not started yet
  | 'SKIPPED'   // Explicitly skipped (by user or system)
  | 'RUNNING'   // Currently executing
  | 'SUCCESS'   // Finished without errors
  | 'ERROR';    // Failed

/**
 * Who initiated the action originally.
 */
export type ActionInitiator = 'user' | 'agent' | 'system';

/**
 * Common fields shared by all actions.
 * Extend this in specialized action types.
 */
export interface ActionBase {
  /** Unique ID for this action (e.g. nanoid) */
  id: string;

  /** Project this action belongs to */
  projectId: string;

  /** Stable action name (see ActionName) */
  action: ActionName;

  /** High-level category (for filtering / analytics) */
  category: ActionCategory;

  /** Human-readable description (shown in UI / logs) */
  description?: string;

  /** Who initiated this action originally */
  createdBy: ActionInitiator;

  /** When the action was created (ms since epoch) */
  createdAt: number;

  /**
   * If true, executor should continue the plan
   * even if this action fails.
   */
  skipOnError?: boolean;

  /**
   * Arbitrary metadata useful for debugging / traceability.
   * Keep it small & serializable.
   */
  metadata?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               File Actions                                 */
/* -------------------------------------------------------------------------- */

export type FileEncoding = 'utf8' | 'base64';

export interface WriteFileAction extends ActionBase {
  action: 'WRITE_FILE';
  category: 'FILE_SYSTEM';

  /** Relative path within the project (e.g. "src/app/page.tsx") */
  path: string;

  /** File contents */
  content: string;

  /** Encoding of content (default: "utf8") */
  encoding?: FileEncoding;

  /**
   * If false (default), fail if file already exists.
   * If true, overwrite existing file.
   */
  overwriteExisting?: boolean;
}

export interface UpdateFileAction extends ActionBase {
  action: 'UPDATE_FILE';
  category: 'FILE_SYSTEM';

  /** File path to update */
  path: string;

  /**
   * New full file content (MVP).
   * (Later we can add structured patch formats / diff ops.)
   */
  newContent: string;

  /** Optional previous content snippet for safety / diff */
  previousContentHint?: string;

  /** Encoding of content (default: "utf8") */
  encoding?: FileEncoding;
}

export interface DeleteFileAction extends ActionBase {
  action: 'DELETE_FILE';
  category: 'FILE_SYSTEM';

  /** File or directory path to delete */
  path: string;

  /** Require file to exist; if true and file is missing → error */
  requireExists?: boolean;
}

export interface MkdirAction extends ActionBase {
  action: 'MKDIR';
  category: 'FILE_SYSTEM';

  /** Directory path to create */
  path: string;

  /** Create parent directories if needed (default: true) */
  recursive?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                             Firestore Actions                              */
/* -------------------------------------------------------------------------- */

export type FirestorePath = string; // e.g. "projects/my-project"
export type FirestoreCollectionPath = string; // e.g. "projects"
export type FirestoreDocumentId = string; // e.g. "abc123"

export interface CreateFirestoreDocAction extends ActionBase {
  action: 'CREATE_FIRESTORE_DOC';
  category: 'FIRESTORE';

  /** Collection path (no document id) e.g. "projects/myProject/tasks" */
  collectionPath: FirestoreCollectionPath;

  /**
   * Document ID. If omitted, executor can auto-generate.
   */
  docId?: FirestoreDocumentId;

  /** Firestore document data */
  data: Record<string, unknown>;
}

export interface UpdateFirestoreDocAction extends ActionBase {
  action: 'UPDATE_FIRESTORE_DOC';
  category: 'FIRESTORE';

  /** Full document path, e.g. "projects/myProject/tasks/task123" */
  docPath: FirestorePath;

  /** Partial data to merge (MVP: merge-style update) */
  data: Record<string, unknown>;

  /** If true, create document if it does not exist */
  upsert?: boolean;
}

export interface DeleteFirestoreDocAction extends ActionBase {
  action: 'DELETE_FIRESTORE_DOC';
  category: 'FIRESTORE';

  /** Full document path to delete */
  docPath: FirestorePath;

  /** If true, ignore if doc doesn't exist */
  ignoreIfMissing?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                               ENV Actions                                  */
/* -------------------------------------------------------------------------- */

export type EnvScope = 'LOCAL' | 'PROJECT' | 'STAGING' | 'PRODUCTION_SIM';

/**
 * Update an environment variable (e.g. .env.local, project config, etc.)
 * NOTE: Actual storage / mapping will be handled by the executor.
 */
export interface UpdateEnvAction extends ActionBase {
  action: 'UPDATE_ENV';
  category: 'ENV';

  /** Key name, e.g. "STRIPE_SECRET_KEY" */
  key: string;

  /**
   * New value. If null, this means "delete" / "unset" the variable.
   */
  value: string | null;

  /** Where this env change should apply. */
  scope: EnvScope;

  /**
   * Optional hint about underlying file or configuration store,
   * e.g. ".env.local" or "firebaseFunctionsConfig".
   */
  targetHint?: string;
}

/* -------------------------------------------------------------------------- */
/*                             Deployment Actions                             */
/* -------------------------------------------------------------------------- */

export type DeployTarget = 'VERCEL' | 'FIREBASE' | 'CUSTOM';
export type DeployMode = 'PREVIEW' | 'PRODUCTION';

export interface RunDeployAction extends ActionBase {
  action: 'RUN_DEPLOY';
  category: 'DEPLOYMENT';

  /** Deploy target/platform */
  target: DeployTarget;

  /** Preview or production deployment */
  mode: DeployMode;

  /** Optional message visible in logs / history */
  message?: string;

  /** Arbitrary config, e.g. branch, vercelProjectId, etc. */
  config?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                              Memory Actions                                */
/*              (Bridge layer on top of Phase 94 memory system)              */
/* -------------------------------------------------------------------------- */

export interface AppendMemoryNoteAction extends ActionBase {
  action: 'APPEND_MEMORY_NOTE';
  category: 'MEMORY';

  /** Which section to append to (e.g. "TECH_STACK", "DONE_DECISIONS") */
  sectionId: string;

  /** Text to append (the executor will format it if needed) */
  note: string;
}

export interface SetMemorySectionAction extends ActionBase {
  action: 'SET_MEMORY_SECTION';
  category: 'MEMORY';

  /** Section ID to override or create */
  sectionId: string;

  /** New full content for this section */
  content: string;
}

/* -------------------------------------------------------------------------- */
/*                               Tool Actions                                 */
/* -------------------------------------------------------------------------- */

/**
 * Generic tool call action (for future plugins / external tools).
 * For Phase 95 MVP we just define the shape; executor can be a stub.
 */
export interface CallToolAction extends ActionBase {
  action: 'CALL_TOOL';
  category: 'TOOL';

  /** Tool identifier, e.g. "GIT_COMMIT", "SEND_EMAIL", "RUN_TESTS" */
  toolName: string;

  /** Tool-specific arguments */
  args: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                    Union Types & Plan / Execution Types                    */
/* -------------------------------------------------------------------------- */

export type FileSystemAction =
  | WriteFileAction
  | UpdateFileAction
  | DeleteFileAction
  | MkdirAction;

export type FirestoreAction =
  | CreateFirestoreDocAction
  | UpdateFirestoreDocAction
  | DeleteFirestoreDocAction;

export type EnvAction = UpdateEnvAction;
export type DeploymentAction = RunDeployAction;
export type MemoryAction = AppendMemoryNoteAction | SetMemorySectionAction;
export type ToolAction = CallToolAction;

/**
 * All supported executable actions (MVP).
 */
export type AnyAction =
  | FileSystemAction
  | FirestoreAction
  | EnvAction
  | DeploymentAction
  | MemoryAction
  | ToolAction;

/**
 * Error information captured during action execution.
 */
export interface ActionError {
  code?: string;
  message: string;
  details?: unknown;
}

/**
 * Execution result for a single action.
 * The `output` is intentionally generic – executor decides the structure.
 */
export interface ActionExecutionResult {
  status: ActionStatus;
  startedAt: number;
  finishedAt: number;
  logs?: string[];
  output?: unknown;
  error?: ActionError;
}

/**
 * One step within an Action Plan.
 */
export interface PlannedAction<TAction extends AnyAction = AnyAction> {
  /** Order in the plan (0-based or 1-based, up to the executor) */
  index: number;

  /** The action to execute */
  action: TAction;

  /** Current status (PENDING by default) */
  status: ActionStatus;

  /** Last execution result (if executed) */
  result?: ActionExecutionResult;
}

/**
 * Full plan for a given user request.
 */
export interface ActionPlan<TAction extends AnyAction = AnyAction> {
  /** Plan ID (for logs / history / replay) */
  id: string;

  /** Project this plan is associated with */
  projectId: string;

  /** Optional short summary (shown in UI) */
  summary: string;

  /** Who initiated this plan */
  createdBy: ActionInitiator;

  /** When the plan was created */
  createdAt: number;

  /** Optional natural-language description of the intent */
  userIntent?: string;

  /** Ordered list of planned actions */
  steps: PlannedAction<TAction>[];

  /**
   * Whether the plan has been executed automatically already
   * or just saved for review.
   */
  autoExecuted?: boolean;
}
