import { BaseAgent } from "../baseAgent";
import type { AgentMessage } from "@/lib/types/agent";
import type { ContextHandle } from "@/lib/types/context";

export class PlannerAgent extends BaseAgent {
  constructor(id = "planner") { super(id, "planner"); }

  async handle(input: AgentMessage, ctx: ContextHandle): Promise<AgentMessage> {
    // TODO: parse goal → sub-tasks; add ctx.hints
    const plan = `Plan: research key points for goal → "${ctx.goal}"`;
    return { type: "PLAN", content: plan, from: this.id, to: ["researcher"] };
  }
}
