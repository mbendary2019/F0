import { BaseAgent } from "../baseAgent";
import type { AgentMessage } from "@/lib/types/agent";
import type { ContextHandle } from "@/lib/types/context";
import { retrieve } from "@/orchestrator/rag/retriever";
import { rank } from "@/orchestrator/rag/ranker";
import { buildCitations } from "@/orchestrator/rag/enrichers";

export class ResearcherAgent extends BaseAgent {
  constructor(id = "researcher") { super(id, "researcher"); }

  async handle(input: AgentMessage, ctx: ContextHandle): Promise<AgentMessage> {
    // TODO: call retriever → rank → enrich
    const query = ctx.goal;
    const rawDocs = await retrieve(query, ctx);
    const ranked = await rank(rawDocs, query);
    const citations = buildCitations(ranked.slice(0, 5));

    const facts = `Found ${citations.length} sources related to: "${query}"`;
    return {
      type: "FACT",
      content: facts,
      evidence: citations,
      from: this.id,
      to: ["synthesizer"],
    };
  }
}
