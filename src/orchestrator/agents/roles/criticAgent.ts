import { BaseAgent } from "../baseAgent";
import type { AgentMessage } from "@/lib/types/agent";
import type { ContextHandle } from "@/lib/types/context";

export class CriticAgent extends BaseAgent {
  constructor(id = "critic") { super(id, "critic"); }

  async handle(input: AgentMessage, ctx: ContextHandle): Promise<AgentMessage> {
    // TODO: validate hypothesis, check for bias/hallucination
    const isValid = true; // placeholder logic

    if (isValid) {
      return {
        type: "FINAL",
        content: input.content,
        evidence: input.evidence,
        from: this.id,
        meta: { validated: true },
      };
    } else {
      return {
        type: "CRITIQUE",
        content: "Hypothesis needs more evidence",
        from: this.id,
        to: ["researcher"],
      };
    }
  }
}
