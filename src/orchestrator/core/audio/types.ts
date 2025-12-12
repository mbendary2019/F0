// orchestrator/core/audio/types.ts
// =============================================================================
// Phase 161.1 – Audio Agent Types
// Types for voice-to-requirements/tasks conversion
// =============================================================================

/**
 * Mode for audio analysis
 */
export type AudioAnalysisMode =
  | 'auto'          // Auto-detect intent from content
  | 'transcribe'    // Just transcribe the audio
  | 'requirements'  // Extract requirements/specs
  | 'bug'           // Extract bug report details
  | 'feature';      // Extract feature request

/**
 * Input for audio analysis request
 */
export interface AudioAnalysisInput {
  attachmentId: string;
  projectId: string;
  mode: AudioAnalysisMode;
  options?: {
    language?: string;           // Language hint (e.g., 'en', 'ar')
    includeTimestamps?: boolean; // Include word-level timestamps
    maxTasks?: number;           // Max suggested tasks to return
    speakerDiarization?: boolean; // Detect multiple speakers
  };
}

/**
 * Suggested task extracted from audio
 */
export interface SuggestedTask {
  label: string;
  type: 'feature' | 'bug' | 'doc' | 'test' | 'refactor' | 'chore';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  estimatedEffort?: 'small' | 'medium' | 'large';
}

/**
 * User story extracted from audio
 */
export interface UserStory {
  asA: string;      // "As a [role]"
  iWant: string;    // "I want [feature]"
  soThat: string;   // "So that [benefit]"
  acceptanceCriteria?: string[];
}

/**
 * Bug report extracted from audio
 */
export interface BugReport {
  summary: string;
  stepsToReproduce?: string[];
  expectedBehavior?: string;
  actualBehavior?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  affectedArea?: string;
}

/**
 * Output from audio analysis
 */
export interface AudioAnalysisOutput {
  attachmentId: string;
  mode: AudioAnalysisMode;
  success: boolean;
  result?: {
    // Transcription
    transcript?: string;
    segments?: TranscriptSegment[];

    // Summary
    summary?: string;

    // Extracted items
    suggestedTasks?: SuggestedTask[];
    requirements?: string[];
    userStories?: UserStory[];
    bugReport?: BugReport;

    // Metadata
    detectedIntent?: 'bug' | 'feature' | 'question' | 'feedback' | 'general';
    confidence?: number;      // 0-1
    duration?: number;        // seconds
    language?: string;        // detected language
    speakerCount?: number;    // number of speakers detected
  };
  error?: string;
  processingTime?: number;    // ms
}

/**
 * Transcript segment with timing
 */
export interface TranscriptSegment {
  text: string;
  start: number;    // seconds
  end: number;      // seconds
  speaker?: string; // speaker ID if diarization enabled
  confidence?: number;
}

/**
 * Audio processing job status
 */
export type AudioJobStatus =
  | 'queued'
  | 'transcribing'
  | 'analyzing'
  | 'completed'
  | 'failed';

/**
 * Audio processing job
 */
export interface AudioJob {
  id: string;
  attachmentId: string;
  projectId: string;
  mode: AudioAnalysisMode;
  status: AudioJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: AudioAnalysisOutput;
  error?: string;
  retryCount?: number;
}

/**
 * Configuration for AudioAgent
 */
export interface AudioAgentConfig {
  pollIntervalMs?: number;        // Queue poll interval (default: 5000)
  maxRetries?: number;            // Max retries per job (default: 3)
  timeoutMs?: number;             // Job timeout (default: 120000)
  enableAutoProcessing?: boolean; // Auto-process new audio attachments
  defaultLanguage?: string;       // Default language hint
}

/**
 * Supported audio MIME types
 */
export const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',      // MP3
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp4',       // M4A
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
];

/**
 * Check if MIME type is supported audio
 */
export function isSupportedAudioType(mimeType: string): boolean {
  return SUPPORTED_AUDIO_TYPES.includes(mimeType.toLowerCase());
}

/**
 * Get audio format from MIME type
 */
export function getAudioFormat(mimeType: string): string {
  const formatMap: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/x-wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/flac': 'flac',
  };
  return formatMap[mimeType.toLowerCase()] || 'unknown';
}

console.log('[161.1][AUDIO] Types loaded');
