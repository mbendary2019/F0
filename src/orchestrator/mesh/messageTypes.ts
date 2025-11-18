import type { AgentMessage } from "@/lib/types/agent";

export type MeshTrace = {
  id: string;
  messages: AgentMessage[];
  stats?: { hops: number; ms: number };
};
