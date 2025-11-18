/**
 * Timeline Types (Phase 62 Day 1)
 *
 * Type definitions for timeline events, session summaries, and view models.
 * Used to consume ops_events and display them in /ops/timeline UI.
 */

/**
 * Supported mesh event types
 */
export type MeshEventType =
  | "mesh.start"
  | "rag.retrieve"
  | "rag.validate"
  | "mesh.consensus"
  | "mesh.final";

/**
 * Base structure for all ops events
 */
export type OpsEventBase = {
  ts: number;
  type: MeshEventType | string;
  sessionId: string;
  userId?: string;
};

/**
 * RAG validation event
 */
export type RagValidateEvent = OpsEventBase & {
  type: "rag.validate";
  score?: number;
  subscores?: Record<string, number>;
  model_version?: string;
  strategy?: string;
};

/**
 * Mesh start event
 */
export type MeshStartEvent = OpsEventBase & {
  type: "mesh.start";
  goal: string;
};

/**
 * RAG retrieve event
 */
export type RagRetrieveEvent = OpsEventBase & {
  type: "rag.retrieve";
  k?: number;
  ms?: number;
  sources?: string[];
};

/**
 * Mesh consensus event
 */
export type MeshConsensusEvent = OpsEventBase & {
  type: "mesh.consensus";
  strategy?: string;
  votes?: Record<string, number>;
};

/**
 * Mesh final event
 */
export type MeshFinalEvent = OpsEventBase & {
  type: "mesh.final";
  ms_total?: number;
  citations_count?: number;
};

/**
 * Union of all event types
 */
export type AnyEvent =
  | OpsEventBase
  | RagValidateEvent
  | MeshStartEvent
  | RagRetrieveEvent
  | MeshConsensusEvent
  | MeshFinalEvent;

/**
 * Normalized timeline item for UI display
 */
export type TimelineItem = {
  /** Firestore document ID */
  id: string;

  /** Session identifier */
  sessionId: string;

  /** Unix timestamp in milliseconds */
  ts: number;

  /** Human-readable title for display */
  label: string;

  /** Event type */
  type: MeshEventType | string;

  /** Additional metadata from the event */
  meta?: Record<string, any>;

  /** Severity level for UI styling */
  severity?: "info" | "warn" | "error";
};

/**
 * Validation statistics
 */
export type ValidationStats = {
  /** Total number of validations */
  count: number;

  /** Average validation score (0-1) */
  avgScore?: number;

  /** Count of validations by model version */
  byModel?: Record<string, number>;

  /** Count of validations by strategy */
  byStrategy?: Record<string, number>;

  /** Count of passed validations */
  passed?: number;

  /** Count of failed validations */
  failed?: number;
};

/**
 * Citation statistics
 */
export type CitationStats = {
  /** Total citations across all events */
  total?: number;

  /** Average citations per validation */
  average?: number;
};

/**
 * Session summary with events and statistics
 */
export type SessionSummary = {
  /** Session identifier */
  sessionId: string;

  /** User identifier */
  userId?: string;

  /** Session start timestamp */
  startedAt?: number;

  /** Session end timestamp */
  endedAt?: number;

  /** Session duration in milliseconds */
  durationMs?: number;

  /** All events in the session (sorted by timestamp) */
  events: TimelineItem[];

  /** Aggregated statistics */
  stats: {
    /** Validation statistics */
    validations: ValidationStats;

    /** Citation statistics */
    citations?: CitationStats;

    /** Retrieval statistics */
    retrievals?: {
      count: number;
      avgMs?: number;
    };
  };
};

/**
 * Timeline query parameters
 */
export type TimelineQuery = {
  /** Start timestamp filter (inclusive) */
  from?: number;

  /** End timestamp filter (inclusive) */
  to?: number;

  /** Filter by session ID */
  sessionId?: string;

  /** Filter by strategy (for rag.validate events) */
  strategy?: string;

  /** Filter by event type */
  type?: string;

  /** Maximum number of items to return */
  limit?: number;

  /** Cursor for pagination (document ID) */
  cursor?: string;
};

/**
 * Timeline API response
 */
export type TimelineResponse = {
  /** Timeline items */
  items: TimelineItem[];

  /** Next cursor for pagination (null if no more items) */
  nextCursor: string | null;

  /** Number of items returned */
  count: number;
};
