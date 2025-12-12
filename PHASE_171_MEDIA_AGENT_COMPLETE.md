# Phase 171: Media Agent - Vision Analysis System

## Overview

Phase 171 implements a comprehensive Media Agent for analyzing images and PDFs using vision AI models. It integrates with Phase 170's Multi-Model Orchestrator for intelligent model routing and fallback.

## Features

### 1. Multi-Provider Vision Support

| Provider | Models | Best For |
|----------|--------|----------|
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Haiku | UI analysis, code extraction |
| **OpenAI** | GPT-4o, GPT-4o-mini | General analysis, accessibility |
| **Google** | Gemini 1.5 Flash, Gemini 1.5 Pro | PDF analysis, cost-effective |

### 2. Analysis Intents

| Intent | Description | Best Model |
|--------|-------------|------------|
| `general_description` | Describe image/document content | gpt-4o-mini |
| `ui_extraction` | Extract UI components & design tokens | claude-sonnet |
| `code_extraction` | Extract code from screenshots | claude-sonnet |
| `document_summary` | Summarize document content | gemini-pro |
| `data_extraction` | Extract tables, charts, data | gpt-4o |
| `error_analysis` | Analyze error screenshots | claude-sonnet |
| `design_feedback` | UI/UX design critique | claude-sonnet-4 |
| `accessibility_audit` | WCAG compliance check | claude-sonnet-4 |

### 3. User Tier Based Routing

| Tier | Available Models |
|------|------------------|
| **free** | gpt-4o-mini, gemini-flash |
| **pro** | claude-sonnet, gpt-4o, gemini-pro |
| **enterprise** | claude-sonnet-4, all models |

## Architecture

```
orchestrator/core/media/
├── mediaTypes.ts          # All TypeScript interfaces
├── mediaAgent.ts          # Main orchestrator
├── visionRouter.ts        # Intelligent model routing
├── index.ts               # Public exports
├── extractors/
│   ├── imageExtractor.ts  # Image validation & preparation
│   └── pdfExtractor.ts    # PDF text extraction
└── prompts/
    ├── visionAnalysisPrompt.ts  # Intent-based prompts
    └── uiExtractionPrompt.ts    # Specialized UI prompts
```

## API Reference

### API Route

**POST** `/api/media/vision`

```typescript
// Request
{
  "media": {
    "content": "<base64_or_url>",
    "contentType": "base64" | "url",
    "mimeType": "image/png" | "application/pdf",
    "filename": "screenshot.png"
  },
  "intent": "ui_extraction",
  "userPrompt": "Extract all buttons",
  "userTier": "pro",
  "maxTokens": 2000
}

// Response
{
  "success": true,
  "mediaType": "image",
  "intent": "ui_extraction",
  "analysis": {
    "description": "Dashboard UI with navigation...",
    "findings": ["Found 3 buttons", "Card layout"],
    "uiComponents": [...],
    "confidence": 0.92
  },
  "modelUsed": "claude-3-5-sonnet-20241022",
  "providerUsed": "anthropic",
  "metrics": {
    "totalLatencyMs": 2340,
    "tokens": { "input": 1200, "output": 450 },
    "estimatedCostUsd": 0.0024
  }
}
```

**GET** `/api/media/vision` - Get supported intents and formats

### Programmatic Usage

```typescript
import {
  analyzeMedia,
  analyzeImage,
  analyzePDF,
  analyzeImageUrl,
  VisionRouter,
} from '@/orchestrator/core/media';

// Quick image analysis
const result = await analyzeImage(
  base64String,
  'image/png',
  'ui_extraction',
  'What buttons are visible?'
);

// PDF analysis
const pdfResult = await analyzePDF(
  pdfBase64,
  'document_summary',
  'List the key findings'
);

// Image from URL
const urlResult = await analyzeImageUrl(
  'https://example.com/screenshot.png',
  'error_analysis'
);

// Full control
const fullResult = await analyzeMedia({
  media: {
    content: base64String,
    contentType: 'base64',
    mimeType: 'image/png',
  },
  intent: 'accessibility_audit',
  userPrompt: 'Check WCAG compliance',
  userTier: 'enterprise',
  projectContext: {
    projectId: 'proj_123',
    techStack: ['React', 'Tailwind'],
  },
  forceModel: 'claude-sonnet-4-20250514',
  maxTokens: 3000,
});
```

### Vision Router

```typescript
import { VisionRouter, routeVision } from '@/orchestrator/core/media';

// Get routing decision
const routing = VisionRouter.route({
  mediaType: 'image',
  intent: 'ui_extraction',
  userTier: 'pro',
  fileSizeBytes: 500000,
  isUrgent: false,
});

console.log(routing.primaryModel);  // 'claude-3-5-sonnet-20241022'
console.log(routing.fallbacks);     // ['gpt-4o', 'gemini-1.5-pro']
console.log(routing.reason);        // 'Intent: ui_extraction...'

// Check available providers
const providers = VisionRouter.getAvailableProviders();
// ['anthropic', 'openai', 'gemini']

// Cost estimation
const cost = VisionRouter.estimateCost('gpt-4o', 1000, 500);
// 0.0075 (USD)
```

### PDF Extraction

```typescript
import {
  extractPDFContent,
  chunkPDFText,
  isScannedPDF,
} from '@/orchestrator/core/media';

// Extract text from PDF
const extracted = await extractPDFContent({
  content: pdfBase64,
  contentType: 'base64',
  mimeType: 'application/pdf',
});

console.log(extracted.text);       // Full text content
console.log(extracted.pageCount);  // 15
console.log(extracted.language);   // 'en'

// Chunk for processing
const chunks = chunkPDFText(extracted.text!, 4000, 200);
// ['chunk1...', 'chunk2...', 'chunk3...']

// Check if scanned (image-based)
const scanned = await isScannedPDF(input);
// true/false
```

## Supported Formats

### Images
- `image/png`
- `image/jpeg`
- `image/gif`
- `image/webp`

### Documents
- `application/pdf`

### Limits
- Max image size: 20MB
- Max PDF size: 50MB
- Max PDF pages: 100

## Testing

```bash
# Test image analysis
npx tsx scripts/test-media-agent-image.ts

# Test PDF analysis
npx tsx scripts/test-media-agent-pdf.ts

# Test via API
curl -X GET http://localhost:3030/api/media/vision

curl -X POST http://localhost:3030/api/media/vision \
  -H "Content-Type: application/json" \
  -d '{
    "media": {
      "content": "<base64>",
      "contentType": "base64",
      "mimeType": "image/png"
    },
    "intent": "general_description"
  }'
```

## Environment Variables

```bash
# At least one of these is required
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AIza...
# or
GEMINI_API_KEY=AIza...
```

## Files Created

| File | Purpose |
|------|---------|
| `orchestrator/core/media/mediaTypes.ts` | Type definitions |
| `orchestrator/core/media/mediaAgent.ts` | Main orchestrator |
| `orchestrator/core/media/visionRouter.ts` | Model routing |
| `orchestrator/core/media/index.ts` | Public exports |
| `orchestrator/core/media/extractors/imageExtractor.ts` | Image processing |
| `orchestrator/core/media/extractors/pdfExtractor.ts` | PDF extraction |
| `orchestrator/core/media/prompts/visionAnalysisPrompt.ts` | Analysis prompts |
| `orchestrator/core/media/prompts/uiExtractionPrompt.ts` | UI-specific prompts |
| `src/app/api/media/vision/route.ts` | API endpoint |
| `scripts/test-media-agent-image.ts` | Image tests |
| `scripts/test-media-agent-pdf.ts` | PDF tests |

## Integration with Phase 170

Phase 171 leverages Phase 170's LLM infrastructure:

```typescript
// Uses Phase 170 client factory
import { LLMClientFactory } from '../llm/clientFactory';

// For text analysis (extracted PDFs)
const client = LLMClientFactory.getByProvider(provider);
const response = await client.chat(options);
```

## Response Structure

### AnalysisResult

```typescript
interface AnalysisResult {
  description: string;           // Main description
  findings: string[];            // Key observations
  uiComponents?: UIComponent[];  // For ui_extraction
  codeBlocks?: CodeBlock[];      // For code_extraction
  dataPoints?: DataPoint[];      // For data_extraction
  suggestions?: string[];        // Recommendations
  confidence: number;            // 0-1 confidence score
}
```

### UIComponent (for ui_extraction)

```typescript
interface UIComponent {
  type: 'button' | 'input' | 'card' | ...;
  name?: string;
  description: string;
  position?: { x, y, width, height };
  styles?: {
    colors?: string[];
    typography?: string;
    spacing?: string;
  };
}
```

## Date

Completed: December 12, 2025
