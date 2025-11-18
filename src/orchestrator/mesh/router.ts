import type { Agent, AgentMessage } from "@/lib/types/agent";
import type { ContextHandle } from "@/lib/types/context";
import type { MeshRoute } from "./protocol";

export type RouterResult = { final: AgentMessage; trace: AgentMessage[] };

export async function runMesh(
  agents: Record<string, Agent>,
  entry: AgentMessage,
  route: MeshRoute,
  ctx: ContextHandle
): Promise<RouterResult> {
  const trace: AgentMessage[] = [];
  let current: AgentMessage = entry;
  let hops = 0;
  const maxHops = route.policy.maxHops ?? 6;

  while (hops < maxHops) {
    const targets = route.to;
    const results: AgentMessage[] = [];

    for (const t of targets) {
      const agent = agents[t];
      if (!agent) continue;
      const out = await agent.handle(current, ctx);
      trace.push(out);
      results.push(out);
      if (out.type === "FINAL") {
        return { final: out, trace };
      }
    }

    // naive next: pick the last result as next hop input
    current = results[results.length - 1] ?? current;
    hops++;
  }

  // fallthrough: return last message
  return { final: current, trace };
}
