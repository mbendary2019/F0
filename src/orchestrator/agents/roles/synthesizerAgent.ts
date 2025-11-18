import { BaseAgent } from "../baseAgent";
import type { AgentMessage } from "@/lib/types/agent";
import type { ContextHandle } from "@/lib/types/context";

export class SynthesizerAgent extends BaseAgent {
  constructor(id = "synthesizer") { super(id, "synthesizer"); }

  async handle(input: AgentMessage, ctx: ContextHandle): Promise<AgentMessage> {
    // TODO: combine evidence into coherent answer
    const evidence = input.evidence ?? [];
    const summary = `Synthesized answer from ${evidence.length} sources for "${ctx.goal}"`;

    return {
      type: "HYPOTHESIS",
      content: summary,
      evidence,
      from: this.id,
      to: ["critic"],
    };
  }
}
