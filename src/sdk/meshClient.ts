import type { AgentMessage } from "@/lib/types/agent";
import type { ContextHandle } from "@/lib/types/context";

export type MeshExecuteRequest = {
  goal: string;
  hints?: string[];
  clusterIds?: string[];
  strategy?: "majority" | "critic";
};

export type MeshExecuteResponse = {
  sessionId: string;
  final: AgentMessage;
  trace: AgentMessage[];
  consensus: {
    accepted: boolean;
    disagreements?: number;
  };
  metrics: {
    totalMs: number;
    tokensUsed: number;
    citationsCount: number;
  };
};

export type MeshContinueRequest = {
  sessionId: string;
  feedback: string;
};

/**
 * Client SDK for interacting with the Cognitive Mesh API
 */
export class MeshClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(options: { baseUrl?: string; apiKey?: string } = {}) {
    this.baseUrl = options.baseUrl ?? "/api/mesh";
    this.apiKey = options.apiKey;
  }

  /**
   * Execute a new mesh task
   */
  async execute(request: MeshExecuteRequest): Promise<MeshExecuteResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mesh execute failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Continue an existing mesh session with feedback
   */
  async continue(request: MeshContinueRequest): Promise<MeshExecuteResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/continue`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mesh continue failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Stream mesh execution with real-time updates
   * TODO: implement SSE streaming
   */
  async *stream(request: MeshExecuteRequest): AsyncGenerator<AgentMessage> {
    // Placeholder: fall back to execute
    const result = await this.execute(request);
    for (const msg of result.trace) {
      yield msg;
    }
  }
}

/**
 * Create a mesh client instance
 */
export function createMeshClient(options?: { baseUrl?: string; apiKey?: string }): MeshClient {
  return new MeshClient(options);
}
