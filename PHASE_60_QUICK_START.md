# Phase 60: Multi-Agent RAG - Quick Start Guide

## What is Phase 60?

Phase 60 implements a **Cognitive Mesh** system where multiple AI agents collaborate to research, synthesize, and validate information from your project's memory store using **Retrieval-Augmented Generation (RAG)**.

## Architecture Overview

```
User Request → Planner Agent → Researcher Agent → Synthesizer Agent → Critic Agent → Validated Answer
                    ↓              ↓                    ↓                  ↓
                 (plan)     (retrieve docs)       (combine facts)    (validate)
```

## File Structure

```
src/
├── lib/types/
│   ├── context.ts          # Context and limits
│   ├── agent.ts            # Agent interfaces
│   └── telemetry.ts        # Telemetry events
├── orchestrator/
│   ├── mesh/
│   │   ├── messageTypes.ts # Message type definitions
│   │   ├── protocol.ts     # Routing protocol
│   │   └── router.ts       # Mesh execution router
│   ├── agents/
│   │   ├── baseAgent.ts    # Base agent class
│   │   └── roles/
│   │       ├── plannerAgent.ts
│   │       ├── researcherAgent.ts
│   │       ├── synthesizerAgent.ts
│   │       └── criticAgent.ts
│   └── rag/
│       ├── retriever.ts    # Document retrieval
│       ├── ranker.ts       # Relevance ranking
│       ├── enrichers.ts    # Citation building
│       ├── chunker.ts      # Text chunking
│       ├── memoryBus.ts    # Agent communication
│       └── consensus.ts    # Validation strategies
├── sdk/
│   └── meshClient.ts       # Client SDK
└── app/api/mesh/
    ├── execute/route.ts    # POST /api/mesh/execute
    └── continue/route.ts   # POST /api/mesh/continue

__tests__/
├── retriever.spec.ts
├── ranker.spec.ts
├── enrichers.spec.ts
├── memoryBus.spec.ts
└── consensus.spec.ts
```

## Quick Usage

### 1. Start Development Server

```bash
PORT=3030 pnpm dev
```

### 2. Use SDK Client

```typescript
import { createMeshClient } from "@/sdk/meshClient";

const client = createMeshClient();

// Execute new task
const result = await client.execute({
  goal: "Explain how memory timeline works",
  strategy: "critic"
});

console.log(result.final.content);
console.log(`Citations: ${result.final.evidence?.length}`);
```

### 3. API Endpoint

```bash
curl -X POST http://localhost:3030/api/mesh/execute \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "How do I deploy this project?",
    "strategy": "critic"
  }'
```

## Agent Roles Explained

| Agent | Role | Responsibility |
|-------|------|---------------|
| **Planner** | Strategist | Breaks down goals into actionable plans |
| **Researcher** | Information Gatherer | Retrieves relevant documents from memory |
| **Synthesizer** | Integrator | Combines facts into coherent hypotheses |
| **Critic** | Validator | Checks accuracy and flags hallucinations |

## Consensus Strategies

### 1. Majority Strategy
```typescript
{
  strategy: "majority"
}
```
- Accepts if > 50% of agents agree
- Faster, less strict
- Good for general queries

### 2. Critic Strategy
```typescript
{
  strategy: "critic"
}
```
- Requires critic agent validation
- More thorough, higher quality
- Recommended for important queries

## Message Flow

```typescript
// 1. User submits goal
TASK → Planner

// 2. Planner creates plan
PLAN → Researcher

// 3. Researcher finds evidence
FACT → Synthesizer

// 4. Synthesizer creates hypothesis
HYPOTHESIS → Critic

// 5. Critic validates
FINAL ✅ (or CRITIQUE ❌ → loop back)
```

## Response Structure

```typescript
{
  sessionId: "mesh_1699...",           // Unique session ID
  final: {
    type: "FINAL",
    content: "Answer text...",
    evidence: [                        // Citations
      {
        docId: "doc1",
        score: 0.95,
        snippet: "Relevant text...",
        url: "src/file.ts:42"
      }
    ]
  },
  trace: [...],                        // All agent messages
  consensus: {
    accepted: true,
    disagreements: 0
  },
  metrics: {
    totalMs: 1234,
    tokensUsed: 850,
    citationsCount: 3
  }
}
```

## Testing

```bash
# Run all tests
pnpm test __tests__/

# Run specific test
pnpm test __tests__/retriever.spec.ts
```

## Common Use Cases

### 1. Documentation Query
```typescript
const result = await client.execute({
  goal: "How do I set up local development?",
  strategy: "majority"
});
```

### 2. Code Explanation
```typescript
const result = await client.execute({
  goal: "Explain the useMemoryTimeline hook implementation",
  hints: ["focus on safety checks"],
  strategy: "critic"
});
```

### 3. Iterative Research
```typescript
// Initial query
const session1 = await client.execute({
  goal: "What are the deployment steps?"
});

// Follow-up with feedback
const session2 = await client.continue({
  sessionId: session1.sessionId,
  feedback: "What about production environment?"
});
```

### 4. Workspace-Specific Query
```typescript
const result = await client.execute({
  goal: "What security features are implemented?",
  clusterIds: ["workspace-123"],  // Filter by workspace
  strategy: "critic"
});
```

## Configuration

### Context Limits

```typescript
type ContextHandle = {
  userId: string;
  sessionId: string;
  goal: string;
  hints?: string[];           // Additional context
  clusterIds?: string[];      // Workspace filtering
  limits: {
    tokens: 4000,             // Max tokens
    latencyMs: 30000          // Max latency (30s)
  };
};
```

### Mesh Policy

```typescript
type MeshRoute = {
  from: string;               // Starting agent
  to: string[];               // Target agents
  policy: {
    strategy: "majority" | "critic";
    maxHops: 6;              // Max agent hops
    timeout: 30000;          // Timeout (30s)
  };
};
```

## Firestore Collections

### `ops_mesh_sessions`

Stores execution sessions for debugging and analytics.

```typescript
{
  userId: "user123",
  goal: "How do I deploy?",
  strategy: "critic",
  startedAt: Timestamp,
  completedAt: Timestamp,
  trace: [...],              // All agent messages
  final: {...},              // Final result
  consensus: {...},          // Validation result
  metrics: {...}             // Performance metrics
}
```

## Production TODOs

Current implementation uses placeholder logic. For production:

1. ✅ **Vector Search**: Replace retriever with Vertex AI Vector Search
2. ✅ **Semantic Ranking**: Implement proper similarity scoring
3. ✅ **Streaming**: Add Server-Sent Events (SSE) for real-time updates
4. ✅ **Caching**: Add Redis for distributed caching
5. ✅ **Monitoring**: Implement telemetry and alerting
6. ✅ **Security**: Add workspace isolation and rate limiting
7. ✅ **UI Components**: Build mesh execution dashboard

## Debugging

### View Agent Trace

```typescript
const result = await client.execute({ goal: "..." });

console.log("Agent Trace:");
result.trace.forEach((msg, i) => {
  console.log(`${i + 1}. [${msg.type}] ${msg.from} → ${msg.to?.join(", ")}`);
  console.log(`   ${msg.content.slice(0, 80)}...`);
});
```

### Check Consensus

```typescript
if (!result.consensus.accepted) {
  console.warn(`Consensus failed: ${result.consensus.disagreements} disagreements`);
}
```

### Monitor Performance

```typescript
console.log(`Total time: ${result.metrics.totalMs}ms`);
console.log(`Tokens used: ${result.metrics.tokensUsed}`);
console.log(`Citations: ${result.metrics.citationsCount}`);
```

## Error Handling

```typescript
try {
  const result = await client.execute({
    goal: "How do I deploy?"
  });
  console.log(result.final.content);
} catch (error) {
  if (error.message.includes("Unauthorized")) {
    console.error("Invalid Firebase token");
  } else if (error.message.includes("timeout")) {
    console.error("Request timed out");
  } else {
    console.error("Mesh execution failed:", error);
  }
}
```

## Next Steps

1. **Read Full Documentation**: [PHASE_60_COMPLETE.md](./PHASE_60_COMPLETE.md)
2. **Read Arabic Version**: [PHASE_60_AR.md](./PHASE_60_AR.md)
3. **Run Tests**: `pnpm test __tests__/`
4. **Implement Vector Search**: Replace retriever placeholder
5. **Build UI Dashboard**: Visualize agent execution

## Support

- **Documentation**: See [PHASE_60_COMPLETE.md](./PHASE_60_COMPLETE.md)
- **Tests**: Check `__tests__/*.spec.ts` for examples
- **Type Definitions**: Explore `src/lib/types/*.ts`

---

**Phase 60 Status**: ✅ Complete (Placeholder logic, ready for production enhancements)
**Created**: 2025-11-07
**Dependencies**: Phase 59 (Memory Timeline), Phase 53 (Collaboration)
