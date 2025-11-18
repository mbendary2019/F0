import type { AgentMessage } from "@/lib/types/agent";
import type { ContextHandle } from "@/lib/types/context";

export type ConsensusStrategy = "majority" | "critic";

export type ConsensusResult = {
  accepted: boolean;
  finalMessage?: AgentMessage;
  disagreements?: number;
  reason?: string;
};

/**
 * Validates consensus across agent messages
 */
export async function validateConsensus(
  messages: AgentMessage[],
  strategy: ConsensusStrategy,
  ctx: ContextHandle
): Promise<ConsensusResult> {
  console.log(`[consensus] validating ${messages.length} messages with strategy="${strategy}"`);

  if (messages.length === 0) {
    return { accepted: false, reason: "No messages to validate" };
  }

  switch (strategy) {
    case "majority":
      return validateMajority(messages);

    case "critic":
      return validateCritic(messages);

    default:
      return { accepted: false, reason: `Unknown strategy: ${strategy}` };
  }
}

/**
 * Majority consensus: accept if > 50% of messages agree
 * TODO: implement proper agreement detection (semantic similarity, voting, etc.)
 */
function validateMajority(messages: AgentMessage[]): ConsensusResult {
  const finalMessages = messages.filter((m) => m.type === "FINAL");

  if (finalMessages.length === 0) {
    return { accepted: false, reason: "No FINAL messages found" };
  }

  // Placeholder: accept if we have at least one FINAL message
  const accepted = finalMessages.length > 0;
  const disagreements = messages.length - finalMessages.length;

  return {
    accepted,
    finalMessage: finalMessages[0],
    disagreements,
  };
}

/**
 * Critic consensus: accept only if critic validates
 */
function validateCritic(messages: AgentMessage[]): ConsensusResult {
  const criticMessages = messages.filter((m) => m.from === "critic");
  const finalMessages = criticMessages.filter((m) => m.type === "FINAL");

  if (finalMessages.length === 0) {
    const critiqueMessages = criticMessages.filter((m) => m.type === "CRITIQUE");
    return {
      accepted: false,
      reason: critiqueMessages.length > 0 ? "Critic rejected hypothesis" : "No critic validation",
      disagreements: critiqueMessages.length,
    };
  }

  // Critic validated
  return {
    accepted: true,
    finalMessage: finalMessages[0],
    disagreements: 0,
  };
}

/**
 * Check if consensus was reached in the message trace
 */
export function hasConsensus(messages: AgentMessage[], strategy: ConsensusStrategy): boolean {
  if (strategy === "critic") {
    return messages.some((m) => m.from === "critic" && m.type === "FINAL");
  }

  // Majority: check if we have FINAL messages
  return messages.some((m) => m.type === "FINAL");
}
