# Phase 56 Day 2 - Semantic Search Deployment Guide

## ✅ Implementation Status

### Files Created/Modified

#### Cloud Functions:
- ✅ `functions/src/lib/embeddings/provider.ts` - Embedding provider abstraction (OpenAI/Cloudflare)
- ✅ `functions/src/collab/embeddingTools.ts` - Cosine similarity calculations
- ✅ `functions/src/collab/searchMemories.ts` - Semantic search Cloud Function (v1 API)
- ✅ `functions/src/collab/generateMemoryEmbedding.ts` - Auto-embedding trigger (fixed imports)
- ✅ `functions/src/index.ts` - Function exports (cleaned up)

#### Client SDK:
- ✅ `src/lib/collab/memory/search.ts` - Search SDK with cache, debounce, abort controller
- ✅ `src/lib/collab/memory/similar.ts` - Similar memories & smart hints
- ✅ `src/app/[locale]/ops/memory/page.tsx` - Search UI integrated

#### Deployment Scripts:
- ✅ `scripts/deploy-search.sh` - Automated deployment script

### Build Status

✅ **TypeScript Build:** All searchMemories-related files compile successfully
- Fixed template literal escaping in provider.ts
- Fixed import paths (getEmbeddingProvider)
- Fixed v1 API compatibility

⚠️ **Note:** Some unrelated functions have TypeScript errors (deploy/, exportIncidentsCsv, etc.) but these don't affect searchMemories deployment.

---

## 🚀 Deployment Steps

### 1. Configure Embedding Provider

Choose **one** of the following options:

#### Option A: OpenAI (Recommended)

```bash
# Set API key as a secret
firebase functions:secrets:set OPENAI_API_KEY
# Paste your key when prompted: sk-...

# Configure provider settings
firebase functions:config:set \
  embeddings.provider="openai" \
  embeddings.model="text-embedding-3-small"
```

**Models:**
- `text-embedding-3-small` (1536 dimensions) - Recommended, cost-effective
- `text-embedding-3-large` (3072 dimensions) - Higher quality, more expensive

#### Option B: Cloudflare Workers AI

```bash
# Set credentials as secrets
firebase functions:secrets:set CF_ACCOUNT_ID
firebase functions:secrets:set CF_API_TOKEN

# Configure provider settings
firebase functions:config:set \
  embeddings.provider="cloudflare" \
  embeddings.model="@cf/baai/bge-base-en-v1.5"
```

**Models:**
- `@cf/baai/bge-base-en-v1.5` (768 dimensions) - Free tier available

---

### 2. Deploy Functions

#### Quick Deployment (Using Script):

```bash
./scripts/deploy-search.sh
```

#### Manual Deployment:

```bash
# Build functions
cd functions
pnpm build

# Deploy searchMemories only
firebase deploy --only functions:searchMemories

# Or deploy all collab functions
firebase deploy --only functions:generateMemoryEmbedding,functions:searchMemories
```

---

## 🧪 Testing

### 1. Smoke Test from UI

1. Open: http://localhost:3030/en/ops/memory
2. Enter search queries in the search bar:
   - **Semantic:** "user authentication" (finds related concepts)
   - **Hybrid:** "login error" (combines semantic + keywords)
   - **Keyword:** "firebase" (exact term matching)

3. Verify results show:
   - ✅ Score percentage
   - ✅ Similarity percentage
   - ✅ Result source badge (Semantic/Hybrid/Keyword)
   - ✅ Logical ranking

### 2. Test from Browser Console

```javascript
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const search = httpsCallable(functions, "searchMemories");

const result = await search({
  query: "auth bug",
  roomId: "ide-file-demo-page-tsx", // optional filter
  topK: 5,
  hybridBoost: 0.35
});

console.log(result.data); // { items: [...] }
```

### 3. Test "Find Similar" Feature

1. On the memory timeline page
2. Click any memory card
3. Look for "Find Similar" button
4. Verify similar memories appear below
5. Check that results are semantically related

### 4. Test with cURL (Production)

```bash
curl -X POST "https://us-central1-<PROJECT-ID>.cloudfunctions.net/searchMemories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -d '{
    "query": "authentication error",
    "roomId": "ide-file-demo-page-tsx",
    "topK": 10,
    "hybridBoost": 0.35
  }'
```

---

## 📊 Monitoring

### View Function Logs

```bash
# Last 50 entries
firebase functions:log --only searchMemories --limit 50

# Follow logs in real-time
firebase functions:log --only searchMemories --tail

# Filter by specific log level
firebase functions:log --only searchMemories --severity ERROR
```

### Expected Log Structure

#### Start Log:
```json
{
  "severity": "INFO",
  "message": "searchMemories:start",
  "uid": "abc123",
  "queryLength": 25,
  "roomId": "ide-file-demo-page-tsx",
  "sessionId": null,
  "topK": 10,
  "hybridBoost": 0.35
}
```

#### Success Log:
```json
{
  "severity": "INFO",
  "message": "searchMemories:success",
  "uid": "abc123",
  "resultsCount": 5,
  "candidatesEvaluated": 150,
  "duration": 1234
}
```

#### Error Log:
```json
{
  "severity": "ERROR",
  "message": "searchMemories:error",
  "uid": "abc123",
  "error": "OpenAI API key missing",
  "duration": 45
}
```

---

## 🔍 Search Algorithm Details

### Hybrid Search Formula

```
score = (1 - hybridBoost) × cosineSimilarity + hybridBoost × keywordScore
```

**Parameters:**
- `cosineSimilarity`: 0.0 to 1.0 (semantic similarity)
- `keywordScore`: 0 or 1 (keyword match boolean)
- `hybridBoost`: 0.0 to 1.0 (weight for keyword matching)

**Examples:**
- `hybridBoost=0.15` → Mostly semantic (findSimilar use case)
- `hybridBoost=0.35` → Balanced hybrid (default search)
- `hybridBoost=0.65` → Mostly keyword (exact term search)

### Result Source Classification

```typescript
if (similarity > 0.7 && abs(similarity - score) < 0.1) → "semantic"
else if (score - similarity > 0.2) → "keyword"
else → "hybrid"
```

---

## 🎯 Performance Optimizations

### Client-Side Optimizations

1. **Debouncing** (300ms default)
   ```typescript
   await searchMemoriesDebounced({ query, topK: 10 }, 300);
   ```

2. **In-Memory Cache** (100 entries, LRU eviction)
   ```typescript
   await searchWithCache({ query, roomId });
   ```

3. **Abort Controller** (cancel in-flight requests)
   ```typescript
   // Automatically cancels previous search when new one starts
   ```

### Server-Side Optimizations

1. **Candidate Limiting:** Max 400 documents per query
2. **Top-K Filtering:** Returns max 12 results (or `topK` parameter)
3. **Query Term Filtering:** Only keywords >2 characters

---

## 🚨 Troubleshooting

### Error: "OPENAI_API_KEY is missing"

**Solution:**
```bash
firebase functions:secrets:set OPENAI_API_KEY
```

### Error: "Module has no exported member 'getEmbeddingProvider'"

**Solution:** Already fixed in provider.ts. Run:
```bash
cd functions && pnpm build
```

### Error: Template literal syntax errors

**Solution:** Already fixed. Ensure provider.ts uses proper backticks without escaping.

### No search results returned

**Checklist:**
1. ✅ Are there embeddings in `ops_collab_embeddings` collection?
2. ✅ Run `generateMemoryEmbedding` trigger or backfill manually
3. ✅ Check if `status='ready'` in embedding documents
4. ✅ Verify roomId/sessionId filters match existing data

### Slow search performance

**Solutions:**
1. Reduce `topK` parameter (default: 10)
2. Use roomId/sessionId filters to narrow search space
3. Ensure Firestore indexes are created (check Firebase Console)

---

## 📋 Configuration Reference

### Environment Variables (Preferred for Production)

```bash
# .env in functions directory
EMBEDDINGS_PROVIDER=openai
EMBEDDINGS_MODEL=text-embedding-3-small
OPENAI_API_KEY=sk-...

# OR for Cloudflare
EMBEDDINGS_PROVIDER=cloudflare
EMBEDDINGS_MODEL=@cf/baai/bge-base-en-v1.5
CF_ACCOUNT_ID=...
CF_API_TOKEN=...
```

### Firebase Functions Config (Deprecated in 2026)

```bash
firebase functions:config:get
```

Expected output:
```json
{
  "embeddings": {
    "provider": "openai",
    "model": "text-embedding-3-small"
  },
  "openai": {
    "key": "stored-in-secrets"
  }
}
```

---

## 📝 API Reference

### searchMemories Function

**Type:** HTTPS Callable (v1 API)

**Request:**
```typescript
{
  query: string;           // Required: search query
  roomId?: string;         // Optional: filter by room
  sessionId?: string;      // Optional: filter by session
  topK?: number;           // Optional: max results (default: 10, max: 12)
  hybridBoost?: number;    // Optional: keyword weight (default: 0.35)
}
```

**Response:**
```typescript
{
  items: Array<{
    id: string;            // Memory ID
    roomId: string;        // Room ID
    sessionId: string;     // Session ID
    text: string;          // Memory content (truncated to 800 chars)
    sim: number;           // Cosine similarity (0.0-1.0)
    score: number;         // Hybrid score (0.0-1.0)
    createdAt: Timestamp;  // Creation timestamp
  }>
}
```

---

## 🎉 Next Steps

1. ✅ **Deploy:** Run `./scripts/deploy-search.sh`
2. ✅ **Test:** Open `/en/ops/memory` and try searching
3. ✅ **Monitor:** Check logs with `firebase functions:log`
4. 📊 **Analytics:** Add usage tracking for search queries
5. 🔄 **Backfill:** Run embedding generation for existing memories
6. 📈 **Optimize:** Tune `hybridBoost` based on user feedback

---

## 📚 Related Documentation

- [Phase 53 Day 7 - Memory Embeddings](./PHASE_53_DAY7_EMBEDDINGS.md)
- [Firebase Functions v1 API](https://firebase.google.com/docs/functions/callable)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/models/bge-base-en-v1.5/)

---

**Generated:** 2025-11-06
**Phase:** 56 Day 2 - Semantic Search API + Tactical Improvements
**Status:** ✅ Ready for Deployment
