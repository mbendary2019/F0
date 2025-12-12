# Phase 164 – Media Pre-Processing Pipeline
## (تحويل الميديا لهيكل موحد)

## 1. الهدف

أي صورة / PDF / Audio يترفع على F0 → يتحوّل إلى هيكل موحّد يستخدمه:
- **Phase 163**: UI Builder (layout regions → component tree)
- **Phase 165**: Media Memory Graph (entities → knowledge base)
- **Phase 162**: Media Chat (summary + textBlocks → context)

---

## 2. Data Model

```ts
// orchestrator/core/mediaPreprocess/types.ts

interface MediaPreprocessResult {
  id: string;              // Same as jobId
  projectId: string;
  attachmentId: string;
  kind: 'image' | 'pdf' | 'audio';

  summary: string;         // Human-readable summary
  textBlocks: OcrBlock[];  // Extracted text with positions
  layoutRegions: LayoutRegion[];  // Detected UI components
  style: StylePalette | null;     // Colors, spacing hints
  entities: MediaEntity[]; // Labels, metrics, requirements

  // Audio-specific
  audioSegments?: AudioSegment[];
  audioMeta?: AudioMeta;

  // PDF-specific
  pdfPages?: PdfPage[];
  pdfMeta?: PdfMeta;

  createdAt: number;
  processingTimeMs?: number;
  provider?: 'vision-api' | 'whisper' | 'gemini' | 'tesseract' | 'mock';
}
```

### 2.1 OcrBlock

```ts
interface OcrBlock {
  id: string;
  text: string;
  bbox: [number, number, number, number]; // [x, y, w, h] normalized 0–1
  language?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  confidence?: number;
}
```

### 2.2 LayoutRegion

```ts
type LayoutRegionType =
  | 'header' | 'navbar' | 'sidebar' | 'footer'
  | 'card' | 'form' | 'table' | 'grid'
  | 'hero' | 'modal' | 'button' | 'input'
  | 'image' | 'chart' | 'list' | 'section';

interface LayoutRegion {
  id: string;
  type: LayoutRegionType;
  bbox: [number, number, number, number];
  label?: string;  // e.g., "Login Form", "User Stats Card"
  childrenOcrBlockIds?: string[];
  hasIcon?: boolean;
  hasBorder?: boolean;
  hasBackground?: boolean;
}
```

### 2.3 StylePalette

```ts
interface StylePalette {
  primary: string | null;
  secondary: string | null;
  accents: string[];
  background: string | null;
  textColor: string | null;
  borderRadiusHint?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  shadowLevelHint?: 0 | 1 | 2 | 3;
  spacingHint?: 'tight' | 'normal' | 'roomy';
}
```

### 2.4 AudioSegment

```ts
interface AudioSegment {
  id: string;
  startSec: number;
  endSec: number;
  speakerTag?: string;
  speakerName?: string;
  text: string;
  isQuestion?: boolean;
  isInstruction?: boolean;
  isRequirement?: boolean;
}
```

---

## 3. API Endpoints

### 3.1 Create Preprocessing Job

```
POST /api/media/preprocess
```

**Request:**
```json
{
  "projectId": "proj_123",
  "attachmentId": "att_abc",
  "kind": "image"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "mpj_xxx",
  "status": "DONE",
  "result": { ... }
}
```

### 3.2 Get Result by Attachment

```
GET /api/media/preprocess?projectId=xxx&attachmentId=yyy
```

### 3.3 Get Job Details

```
GET /api/media/preprocess/{jobId}
```

---

## 4. Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Media Preprocess Engine                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Image Pipeline│  │ PDF Pipeline │  │ Audio Pipeline│     │
│  │              │  │              │  │              │       │
│  │ 1. OCR      │  │ 1. Parse     │  │ 1. ASR       │       │
│  │ 2. Layout   │  │ 2. Extract   │  │ 2. Diarize   │       │
│  │ 3. Style    │  │ 3. Sections  │  │ 3. Segment   │       │
│  │ 4. Entities │  │ 4. Entities  │  │ 4. Entities  │       │
│  │ 5. Summary  │  │ 5. Summary   │  │ 5. Summary   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│                          ↓                                   │
│              ┌──────────────────────┐                       │
│              │ MediaPreprocessResult │                       │
│              └──────────────────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
         ┌─────────────────┼─────────────────┐
         ↓                 ↓                 ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  UI Builder  │  │ Media Memory │  │  Media Chat  │
│  (Phase 163) │  │  (Phase 165) │  │  (Phase 162) │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 5. UI Builder Integration (164.7)

When `/api/ui/generate` is called, it now:

1. Checks for existing `MediaPreprocessResult` by attachment ID
2. If found, uses `layoutRegions` to build smart component tree
3. Maps region types to component types:
   - `navbar`, `sidebar` → sections with flex layout
   - `card`, `chart`, `table` → components
   - `button`, `input` → elements
4. Applies `StylePalette` to component visual hints

**Example Flow:**
```
User uploads dashboard.png
    ↓
POST /api/media/preprocess → MediaPreprocessResult
    ↓
POST /api/ui/generate (uses result automatically)
    ↓
Smart component tree with:
  - TopNavigation (from navbar region)
  - SideNavigation (from sidebar region)
  - UsersStatsCard (from card region)
  - MainChart (from chart region)
  - DataTable (from table region)
```

---

## 6. Files Created

| File | Description |
|------|-------------|
| `orchestrator/core/mediaPreprocess/types.ts` | All type definitions |
| `orchestrator/core/mediaPreprocess/firestoreMediaPreprocessStore.ts` | Firestore persistence |
| `orchestrator/core/mediaPreprocess/mediaPreprocessEngine.ts` | Main preprocessing engine |
| `orchestrator/core/mediaPreprocess/index.ts` | Module exports |
| `src/app/api/media/preprocess/route.ts` | POST/GET endpoints |
| `src/app/api/media/preprocess/[jobId]/route.ts` | Job detail endpoint |
| `src/app/api/ui/generate/route.ts` | Updated with Phase 164.7 |

---

## 7. Sub-Phases

| Sub-Phase | Description | Status |
|-----------|-------------|--------|
| 164.0 | Types + Firestore Store | ✅ |
| 164.2 | Engine Skeleton | ✅ |
| 164.3 | Image Pipeline (OCR + Layout + Style) | ✅ |
| 164.4 | PDF Pipeline | ✅ |
| 164.5 | Audio Pipeline (ASR + Diarization) | ✅ |
| 164.6 | API Routes | ✅ |
| 164.7 | UI Builder Integration | ✅ |
| 164.8 | Documentation | ✅ |

---

## 8. Usage Examples

### 8.1 Preprocess an Image

```bash
# Create preprocessing job
curl -X POST http://localhost:3030/api/media/preprocess \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "attachmentId": "att_dashboard",
    "kind": "image"
  }'
```

### 8.2 Get Result

```bash
# Get by attachment
curl "http://localhost:3030/api/media/preprocess?projectId=proj_123&attachmentId=att_dashboard"
```

### 8.3 Generate UI with Preprocessing

```bash
# UI generation will automatically use preprocessing result
curl -X POST http://localhost:3030/api/ui/generate \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_123",
    "attachmentIds": ["att_dashboard"],
    "mode": "dashboard"
  }'
```

---

## 9. Future Enhancements

- [ ] Integrate Google Vision API for real OCR
- [ ] Integrate OpenAI Whisper for audio transcription
- [ ] LLM-based layout detection with GPT-4 Vision
- [ ] Real-time preprocessing on upload
- [ ] Caching layer for repeated preprocessing
- [ ] Background job queue for large files

---

*Phase 164: Media Pre-Processing Pipeline Complete*
