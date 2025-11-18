import type { Agent, AgentMessage } from "@/lib/types/agent";
import type { ContextHandle } from "@/lib/types/context";

export abstract class BaseAgent implements Agent {
  constructor(public id: string, public role: Agent["role"]) {}
  abstract handle(input: AgentMessage, ctx: ContextHandle): Promise<AgentMessage>;
}
