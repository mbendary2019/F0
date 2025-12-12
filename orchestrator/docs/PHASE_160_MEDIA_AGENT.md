# Phase 160 – Media Agent (Image/PDF/Document Understanding)

## 1. Goal

Create an AI-powered MediaAgent that can:
- Analyze images (describe, detect objects, extract text via OCR)
- Extract text from PDFs
- Summarize documents
- Generate embeddings for RAG integration

## 2. Expected Outcome

After Phase 160:

- User uploads image → MediaAgent describes it
- User uploads PDF → MediaAgent extracts text
- User uploads document → MediaAgent summarizes it
- Attachments get embeddings for semantic search

## 3. Architecture

### 3.1 MediaAgent Role

```
AgentRole: 'media'
```

### 3.2 Message Types

```ts
// Request analysis
MEDIA_ANALYZE_REQUEST: {
  attachmentId: string;
  analysisType: 'describe' | 'ocr' | 'extract_text' | 'summarize' | 'embed';
  options?: Record<string, unknown>;
}

// Analysis result
MEDIA_ANALYZE_RESULT: {
  attachmentId: string;
  analysisType: string;
  success: boolean;
  result?: {
    text?: string;
    description?: string;
    embeddings?: number[];
    metadata?: Record<string, unknown>;
  };
  error?: string;
}
```

### 3.3 Integration with Phase 158

MediaAgent consumes from the processing queue created in Phase 158.5:
- `getNextProcessingItem()` → get queued attachment
- `markAttachmentProcessing()` → update status
- `markAttachmentReady()` → store results
- `markAttachmentError()` → handle failures

## 4. Sub-Phases

| Sub-Phase | Description | Status |
|-----------|-------------|--------|
| 160.0 | Architecture & Documentation | ✅ |
| 160.1 | MediaAgent types + skeleton | ✅ |
| 160.2 | MediaAgent bus wiring | ✅ |
| 160.3 | Chat "Analyze" quick action | ✅ |
| 160.4 | Vision API integration | Planned (Phase 161+) |
| 160.5 | PDF text extraction | Planned (Phase 161+) |
| 160.6 | Embedding generation | Planned (Phase 161+) |

## 4.1 Implementation Complete

### Files Created:

| File | Description |
|------|-------------|
| `orchestrator/core/media/types.ts` | MediaAnalysisType, Input/Output interfaces |
| `orchestrator/agents/mediaAgent.ts` | MediaAgent class with queue processing |
| `src/app/api/media/analyze/route.ts` | POST/GET API for analysis requests |
| `src/components/agents/ProjectChatPanel.tsx` | Updated with analyze buttons |
| `src/lib/agents/orchestratorBus.ts` | Wired MediaAgent to bus |

## 5. Implementation

### 5.1 MediaAgent Types

```ts
// orchestrator/core/media/types.ts

export type MediaAnalysisType =
  | 'describe'      // Describe image contents
  | 'ocr'           // Extract text from image
  | 'extract_text'  // Extract text from PDF/doc
  | 'summarize'     // Summarize document
  | 'embed';        // Generate embeddings

export interface MediaAnalysisInput {
  attachmentId: string;
  projectId: string;
  analysisType: MediaAnalysisType;
  options?: {
    language?: string;
    maxLength?: number;
    embedModel?: string;
  };
}

export interface MediaAnalysisOutput {
  attachmentId: string;
  analysisType: MediaAnalysisType;
  success: boolean;
  result?: {
    text?: string;
    description?: string;
    embeddings?: number[];
    confidence?: number;
    language?: string;
    pageCount?: number;
    wordCount?: number;
    metadata?: Record<string, unknown>;
  };
  error?: string;
  processingTime?: number;
}
```

### 5.2 MediaAgent Skeleton

```ts
// orchestrator/agents/mediaAgent.ts

export class MediaAgent {
  private bus: AgentBus;
  private running = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(config: { bus: AgentBus }) {
    this.bus = config.bus;
    this.subscribeToMessages();
    this.startProcessingLoop();
  }

  private subscribeToMessages() {
    this.bus.subscribe('media', async (message) => {
      if (message.kind === 'TASK_ASSIGNMENT') {
        await this.handleTask(message);
      }
    });
  }

  private startProcessingLoop() {
    this.running = true;
    this.pollInterval = setInterval(() => {
      this.processQueue();
    }, 5000);
  }

  private async processQueue() {
    const item = getNextProcessingItem();
    if (!item) return;

    await markAttachmentProcessing(item.attachmentId);

    try {
      const result = await this.analyze(item);
      await markAttachmentReady(item.attachmentId, result);
    } catch (error) {
      await markAttachmentError(item.attachmentId, error.message);
    }
  }

  async analyze(input: MediaAnalysisInput): Promise<MediaAnalysisOutput> {
    // Placeholder - will integrate with Vision API
    return {
      attachmentId: input.attachmentId,
      analysisType: input.analysisType,
      success: true,
      result: {
        description: '[Placeholder] Image analysis pending Vision API integration',
      },
    };
  }

  stop() {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}
```

## 6. Chat Integration

### "Analyze" Quick Action

In ProjectChatPanel, add an "Analyze" button for image attachments:

```tsx
{attachment.kind === 'image' && (
  <Button
    size="sm"
    variant="ghost"
    onClick={() => handleAnalyze(attachment.id)}
  >
    <Sparkles className="h-3 w-3 mr-1" />
    Analyze
  </Button>
)}
```

### API Endpoint

```ts
// POST /api/media/analyze
{
  attachmentId: string;
  analysisType: 'describe' | 'ocr';
}
```

## 7. Future Enhancements (Phase 161+)

- AudioAgent for transcription (Phase 161)
- Real-time Vision API streaming
- Multi-page PDF processing
- Table extraction from documents
- Handwriting recognition
- Face/object detection

## 8. Definition of Done

Phase 160 is complete when:

1. MediaAgent skeleton is created and wired to bus
2. Processing queue integration works
3. Placeholder analysis returns mock results
4. "Analyze" button appears for image attachments
5. Status updates flow through the system

---

*Phase 160: Media Agent Implementation*
