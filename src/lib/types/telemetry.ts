export type EventBase = { ts: number; sessionId: string; userId: string };

export type MeshStart = EventBase & { type: "mesh.start"; goal: string };
export type RagRetrieve = EventBase & { type: "rag.retrieve"; k: number; ms: number; sources: string[] };
export type MeshConsensus = EventBase & { type: "mesh.consensus"; method: string; disagreements?: number };
export type MeshFinal = EventBase & { type: "mesh.final"; tokens: number; ms_total: number; citations_count: number };
export type RagValidate = EventBase & {
  type: "rag.validate";
  score: number;
  subscores: { citation: number; context: number; source: number; relevance: number };
  model_version: string;  // Model version used for validation
  strategy?: string;      // Strategy used (critic, majority, default)
};

export type OpsEvent = MeshStart | RagRetrieve | MeshConsensus | MeshFinal | RagValidate;
