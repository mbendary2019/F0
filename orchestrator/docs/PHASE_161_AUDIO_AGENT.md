# Phase 161 – Audio Agent (Voice → Requirements/Tasks)

## 1. Goal

Create an AI-powered AudioAgent that can:
- Transcribe audio files (MP3, WAV, M4A)
- Extract requirements from voice recordings
- Generate tasks/features/bug descriptions from audio
- Convert spoken ideas into actionable items

## 2. Expected Outcome

After Phase 161:

- User uploads audio recording → AudioAgent transcribes it
- User says "Extract requirements" → AudioAgent generates structured requirements
- Spoken bug reports → Converted to Issue Summary + Suggested Tasks
- Voice feature requests → Converted to User Stories + Tasks

### Example Flow:

```
User uploads: bug_report.m4a
"The login page crashes when I enter a password with special characters like @ or #"

AudioAgent Output:
┌─────────────────────────────────────────┐
│ Issue Summary:                          │
│ Login fails with special char passwords │
│                                         │
│ Suggested Tasks:                        │
│ • Fix password validation regex         │
│ • Add e2e test for special characters   │
│ • Update UI error message               │
│                                         │
│ Type: bug                               │
│ Priority: high                          │
└─────────────────────────────────────────┘
```

## 3. Architecture

### 3.1 AudioAgent Role

```
AgentRole: 'audio'
```

### 3.2 Message Types

```ts
// Request analysis
AUDIO_ANALYZE_REQUEST: {
  attachmentId: string;
  mode: 'auto' | 'transcribe' | 'requirements' | 'bug' | 'feature';
  options?: Record<string, unknown>;
}

// Analysis result
AUDIO_ANALYZE_RESULT: {
  attachmentId: string;
  mode: string;
  success: boolean;
  result?: {
    transcript?: string;
    summary?: string;
    suggestedTasks?: SuggestedTask[];
    requirements?: string[];
    userStories?: string[];
  };
  error?: string;
}
```

### 3.3 Integration with Phase 158

AudioAgent consumes from the same processing queue as MediaAgent:
- Listens for `processType: 'transcribe'`
- Updates attachment status via mediaAgentHooks
- Stores results in attachment metadata

## 4. Sub-Phases

| Sub-Phase | Description | Status |
|-----------|-------------|--------|
| 161.0 | Architecture & Documentation | ✅ |
| 161.1 | Audio types + AudioAgent skeleton | ✅ |
| 161.2 | Audio analyze API endpoint | ✅ |
| 161.3 | Chat UI integration | ✅ |
| 161.4 | Wire AudioAgent to bus | ✅ |
| 161.5 | Whisper API integration | Planned (Phase 162+) |
| 161.6 | Requirements extraction LLM | Planned (Phase 162+) |

## 4.1 Implementation Complete

### Files Created:

| File | Description |
|------|-------------|
| `orchestrator/docs/PHASE_161_AUDIO_AGENT.md` | Architecture documentation |
| `orchestrator/core/audio/types.ts` | AudioAnalysisMode, Input/Output, SuggestedTask, BugReport |
| `orchestrator/agents/audioAgent.ts` | AudioAgent class with queue processing |
| `src/app/api/audio/analyze/route.ts` | POST/GET API for audio analysis |

### Files Updated:

| File | Changes |
|------|---------|
| `src/lib/agents/orchestratorBus.ts` | Wired AudioAgent to bus |
| `src/components/agents/ProjectChatPanel.tsx` | Added audio buttons (Transcribe, Requirements, Bug) |

## 5. Implementation

### 5.1 Audio Types

```ts
// orchestrator/core/audio/types.ts

export type AudioAnalysisMode =
  | 'auto'          // Auto-detect intent
  | 'transcribe'    // Just transcribe
  | 'requirements'  // Extract requirements
  | 'bug'           // Extract bug report
  | 'feature';      // Extract feature request

export interface AudioAnalysisInput {
  attachmentId: string;
  projectId: string;
  mode: AudioAnalysisMode;
  options?: {
    language?: string;
    includeTimestamps?: boolean;
    maxTasks?: number;
  };
}

export interface SuggestedTask {
  label: string;
  type: 'feature' | 'bug' | 'doc' | 'test' | 'refactor';
  priority?: 'low' | 'medium' | 'high';
  description?: string;
}

export interface AudioAnalysisOutput {
  attachmentId: string;
  mode: AudioAnalysisMode;
  success: boolean;
  result?: {
    transcript?: string;
    summary?: string;
    suggestedTasks?: SuggestedTask[];
    requirements?: string[];
    userStories?: string[];
    detectedIntent?: 'bug' | 'feature' | 'question' | 'general';
    confidence?: number;
    duration?: number; // seconds
    language?: string;
  };
  error?: string;
  processingTime?: number;
}
```

### 5.2 AudioAgent Skeleton

```ts
// orchestrator/agents/audioAgent.ts

export class AudioAgent {
  private bus: AgentBus;
  private running = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(config: { bus: AgentBus }) {
    this.bus = config.bus;
    this.subscribeToMessages();
    this.startProcessingLoop();
  }

  async analyze(input: AudioAnalysisInput): Promise<AudioAnalysisOutput> {
    // 1. Transcribe audio
    const transcript = await this.transcribe(input.attachmentId);

    // 2. Extract based on mode
    switch (input.mode) {
      case 'requirements':
        return this.extractRequirements(transcript);
      case 'bug':
        return this.extractBugReport(transcript);
      case 'feature':
        return this.extractFeatureRequest(transcript);
      default:
        return { transcript, summary: this.summarize(transcript) };
    }
  }

  private async transcribe(attachmentId: string): Promise<string> {
    // Placeholder - will integrate with Whisper API
    return '[Placeholder transcript]';
  }

  private extractRequirements(transcript: string): AudioAnalysisOutput {
    // LLM-based extraction
  }

  private extractBugReport(transcript: string): AudioAnalysisOutput {
    // Parse bug details from transcript
  }

  private extractFeatureRequest(transcript: string): AudioAnalysisOutput {
    // Parse feature request from transcript
  }
}
```

## 6. Chat Integration

### Audio Quick Actions

In ProjectChatPanel, for audio attachments:

```tsx
{att.kind === 'audio' && (
  <>
    <button onClick={() => handleAudioAnalyze(att, 'transcribe')}>
      <Mic className="h-3 w-3" /> Transcribe
    </button>
    <button onClick={() => handleAudioAnalyze(att, 'requirements')}>
      <ListTodo className="h-3 w-3" /> Requirements
    </button>
    <button onClick={() => handleAudioAnalyze(att, 'bug')}>
      <Bug className="h-3 w-3" /> Bug Report
    </button>
  </>
)}
```

### API Endpoints

```ts
// POST /api/audio/analyze
{
  attachmentId: string;
  projectId: string;
  mode: 'transcribe' | 'requirements' | 'bug' | 'feature';
}

// GET /api/audio/analyze?attachmentId=xxx
// Returns analysis status and results
```

## 7. Future Enhancements (Phase 162+)

- Real-time voice input (WebRTC)
- Multi-speaker detection
- Conversation threading from audio
- Meeting notes extraction
- Voice commands for IDE actions

## 8. Definition of Done

Phase 161 is complete when:

1. AudioAgent skeleton is created and wired to bus
2. Audio analysis API endpoints work
3. Placeholder transcription returns mock results
4. "Transcribe" and "Requirements" buttons appear for audio attachments
5. Analysis results display in chat as assistant messages

---

*Phase 161: Audio Agent Implementation*
