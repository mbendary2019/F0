import type { ContextHandle, Citation } from "./context";

export type AgentMessageType =
  | "TASK"
  | "FACT"
  | "HYPOTHESIS"
  | "CRITIQUE"
  | "PLAN"
  | "FINAL";

export type AgentMessage = {
  id?: string;
  type: AgentMessageType;
  content: string;
  evidence?: Citation[];
  from: string;
  to?: string[];
  meta?: Record<string, unknown>;
};

export interface Agent {
  id: string;
  role: "planner" | "researcher" | "synthesizer" | "critic";
  handle(input: AgentMessage, ctx: ContextHandle): Promise<AgentMessage>;
}
