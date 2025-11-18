# AI Memory Clustering & Auto-Tagging

Production-ready AI-powered memory clustering using OpenAI embeddings with LLM-based auto-tagging.

## Quick Start

```typescript
import { clusterAndTag } from "./clusterAndTag";

const memories = [
  { id: "1", userId: "user1", text: "Implemented Firebase auth", createdAt: new Date() },
  { id: "2", userId: "user1", text: "Fixed login bug", createdAt: new Date() },
  { id: "3", userId: "user1", text: "Added pricing page", createdAt: new Date() },
];

const results = await clusterAndTag(memories, {
  similarityThreshold: 0.83,
  locale: "en"
});

console.log(`Created ${results.length} clusters`);
```

## Features

- ✅ Adaptive agglomerative clustering
- ✅ OpenAI embeddings (text-embedding-3-large)
- ✅ LLM-powered tagging (GPT-4o-mini)
- ✅ Multi-language support (Arabic + English)
- ✅ Concurrency control & retry logic
- ✅ TypeScript with full type safety

## Files

- **clusterMemory.ts** - Core clustering algorithm (~350 lines)
- **autoTagMemory.ts** - LLM-based tagging (~150 lines)
- **clusterAndTag.ts** - High-level integration + helpers (~180 lines)
- **clusterMemory.test.ts** - Unit tests with mocked OpenAI (~320 lines)

## Configuration

```typescript
// Clustering
{
  embeddingModel: "text-embedding-3-large",
  similarityThreshold: 0.82,  // 0.78-0.88 recommended
  minClusterSize: 2,
  maxClusterSize: 100,
  concurrency: 6,
  maxRetries: 3
}

// Tagging
{
  model: "gpt-4o-mini",
  temperature: 0.2,
  maxTokens: 600,
  maxRetries: 3
}
```

## Environment

```bash
export OPENAI_API_KEY="sk-..."
```

## Documentation

See [PHASE_56_DAY4_COMPLETE.md](../../../PHASE_56_DAY4_COMPLETE.md) for:
- Complete API reference
- Usage examples
- Performance characteristics
- Best practices
- Troubleshooting guide

## Testing

```bash
pnpm test src/lib/ai/memory/clusterMemory.test.ts
```

## Performance

| Items | Time | Memory |
|-------|------|--------|
| 10 | ~2s | ~10MB |
| 50 | ~9s | ~30MB |
| 100 | ~17s | ~60MB |
| 200 | ~38s | ~120MB |

## Next Steps

1. Set `OPENAI_API_KEY`
2. Run tests
3. Try with real data
4. Tune `similarityThreshold`
5. Integrate with UI

## License

Part of From Zero project - Phase 56 Day 4
