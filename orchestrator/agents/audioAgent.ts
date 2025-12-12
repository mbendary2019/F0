// orchestrator/agents/audioAgent.ts
// =============================================================================
// Phase 161.1 – Audio Agent
// Voice-to-requirements/tasks conversion agent
// =============================================================================

import type { AgentBus, AgentMessage } from '../core/multiAgent/types';
import type {
  AudioAnalysisInput,
  AudioAnalysisOutput,
  AudioAgentConfig,
  AudioAnalysisMode,
  SuggestedTask,
  BugReport,
  UserStory,
} from '../core/audio/types';
import { isSupportedAudioType } from '../core/audio/types';
import {
  getNextProcessingItem,
  getAttachmentForProcessing,
  markAttachmentProcessing,
  markAttachmentReady,
  markAttachmentError,
} from '../core/attachments/mediaAgentHooks';

// =============================================================================
// AudioAgent Class
// =============================================================================

export class AudioAgent {
  private bus: AgentBus;
  private config: Required<AudioAgentConfig>;
  private running = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(options: { bus: AgentBus; config?: AudioAgentConfig }) {
    this.bus = options.bus;
    this.config = {
      pollIntervalMs: options.config?.pollIntervalMs ?? 5000,
      maxRetries: options.config?.maxRetries ?? 3,
      timeoutMs: options.config?.timeoutMs ?? 120000,
      enableAutoProcessing: options.config?.enableAutoProcessing ?? true,
      defaultLanguage: options.config?.defaultLanguage ?? 'en',
    };

    this.subscribeToMessages();

    if (this.config.enableAutoProcessing) {
      this.startProcessingLoop();
    }

    console.log('[161.1][AUDIO_AGENT] Initialized');
  }

  // ===========================================================================
  // Message Subscription
  // ===========================================================================

  private subscribeToMessages() {
    this.bus.subscribe('audio', async (message: AgentMessage) => {
      console.log('[161.1][AUDIO_AGENT] Received message:', message.kind);

      switch (message.kind) {
        case 'TASK_ASSIGNMENT':
          await this.handleTaskAssignment(message);
          break;
        case 'INFO_REQUEST':
          await this.handleInfoRequest(message);
          break;
        default:
          console.log('[161.1][AUDIO_AGENT] Unhandled message kind:', message.kind);
      }
    });
  }

  // ===========================================================================
  // Task Handling
  // ===========================================================================

  private async handleTaskAssignment(message: AgentMessage) {
    const payload = message.payload as {
      attachmentId: string;
      mode: AudioAnalysisMode;
      options?: Record<string, unknown>;
    };

    console.log('[161.1][AUDIO_AGENT] Task assignment:', payload.attachmentId);

    const input: AudioAnalysisInput = {
      attachmentId: payload.attachmentId,
      projectId: message.context.projectId,
      mode: payload.mode || 'auto',
      options: payload.options,
    };

    try {
      const result = await this.analyze(input);

      await this.bus.publish({
        id: `audio-result-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: 'audio',
        to: message.from,
        kind: 'TASK_RESULT',
        context: message.context,
        safety: { level: 'low' },
        payload: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.bus.publish({
        id: `audio-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: 'audio',
        to: message.from,
        kind: 'TASK_ERROR',
        context: message.context,
        safety: { level: 'low' },
        payload: {
          attachmentId: payload.attachmentId,
          error: errorMessage,
        },
      });
    }
  }

  private async handleInfoRequest(message: AgentMessage) {
    const payload = message.payload as { query?: string };

    if (payload.query === 'capabilities') {
      await this.bus.publish({
        id: `audio-info-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: 'audio',
        to: message.from,
        kind: 'INFO_RESPONSE',
        context: message.context,
        safety: { level: 'low' },
        payload: {
          capabilities: ['transcribe', 'requirements', 'bug', 'feature', 'auto'],
          supportedTypes: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'],
        },
      });
    }
  }

  // ===========================================================================
  // Processing Queue Loop
  // ===========================================================================

  private startProcessingLoop() {
    this.running = true;
    console.log('[161.1][AUDIO_AGENT] Starting processing loop');

    this.pollInterval = setInterval(async () => {
      if (!this.running) return;
      await this.processNextQueueItem();
    }, this.config.pollIntervalMs);
  }

  private async processNextQueueItem() {
    const item = getNextProcessingItem();
    if (!item || item.processType !== 'transcribe') return;

    console.log('[161.1][AUDIO_AGENT] Processing queue item:', item.attachmentId);

    await markAttachmentProcessing(item.attachmentId);

    try {
      const attachment = await getAttachmentForProcessing(item.attachmentId);
      if (!attachment) {
        throw new Error('Attachment not found');
      }

      if (!isSupportedAudioType(attachment.mimeType)) {
        console.log('[161.1][AUDIO_AGENT] Skipping non-audio:', attachment.mimeType);
        return;
      }

      const input: AudioAnalysisInput = {
        attachmentId: item.attachmentId,
        projectId: item.projectId,
        mode: 'auto',
      };

      const result = await this.analyze(input);

      if (result.success && result.result) {
        await markAttachmentReady(item.attachmentId, {
          audioAnalysis: result.result,
          mode: result.mode,
          processedAt: new Date().toISOString(),
        });
      } else {
        await markAttachmentError(item.attachmentId, result.error || 'Analysis failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await markAttachmentError(item.attachmentId, errorMessage);
    }
  }

  // ===========================================================================
  // Core Analysis
  // ===========================================================================

  async analyze(input: AudioAnalysisInput): Promise<AudioAnalysisOutput> {
    const startTime = Date.now();

    console.log('[161.1][AUDIO_AGENT] Analyzing:', input.attachmentId, input.mode);

    // Get attachment details
    const attachment = await getAttachmentForProcessing(input.attachmentId);
    if (!attachment) {
      return {
        attachmentId: input.attachmentId,
        mode: input.mode,
        success: false,
        error: 'Attachment not found',
      };
    }

    // Check if audio type is supported
    if (!isSupportedAudioType(attachment.mimeType)) {
      return {
        attachmentId: input.attachmentId,
        mode: input.mode,
        success: false,
        error: `Unsupported audio type: ${attachment.mimeType}`,
      };
    }

    // Step 1: Transcribe
    const transcript = await this.transcribe(attachment);

    // Step 2: Analyze based on mode
    const result = await this.performAnalysis(input.mode, transcript, attachment);

    return {
      ...result,
      attachmentId: input.attachmentId,
      mode: input.mode,
      processingTime: Date.now() - startTime,
    };
  }

  // ===========================================================================
  // Transcription (Placeholder - will integrate with Whisper API)
  // ===========================================================================

  private async transcribe(
    attachment: { filename: string; mimeType: string; sizeBytes: number }
  ): Promise<string> {
    // Placeholder implementation
    // In production, this will call Whisper API or similar
    console.log('[161.1][AUDIO_AGENT] Transcribing:', attachment.filename);

    // Simulate transcription based on filename
    const filename = attachment.filename.toLowerCase();

    if (filename.includes('bug') || filename.includes('issue')) {
      return `[Placeholder transcript] I found a bug in the login page. When I try to enter a password with special characters like @ or #, the form validation fails and shows an error. The expected behavior is that any valid password should be accepted. This is blocking users from creating accounts with secure passwords.`;
    }

    if (filename.includes('feature') || filename.includes('request')) {
      return `[Placeholder transcript] I would like to request a new feature for the dashboard. As a project manager, I want to be able to see a timeline view of all tasks so that I can better understand project progress. The timeline should show task dependencies and highlight any blockers.`;
    }

    if (filename.includes('requirement') || filename.includes('spec')) {
      return `[Placeholder transcript] Here are the requirements for the new notification system. First, users should receive real-time notifications for mentions and replies. Second, there should be email digest options - daily or weekly. Third, users can customize which notifications they receive. Fourth, mobile push notifications should be supported.`;
    }

    return `[Placeholder transcript] This is a placeholder transcription for "${attachment.filename}". The actual Whisper API integration is planned for a future update. The audio file is ${Math.round(attachment.sizeBytes / 1024)}KB in ${attachment.mimeType} format.`;
  }

  // ===========================================================================
  // Analysis Methods
  // ===========================================================================

  private async performAnalysis(
    mode: AudioAnalysisMode,
    transcript: string,
    attachment: { filename: string }
  ): Promise<AudioAnalysisOutput> {
    switch (mode) {
      case 'transcribe':
        return this.createTranscriptResult(transcript, attachment);

      case 'requirements':
        return this.extractRequirements(transcript, attachment);

      case 'bug':
        return this.extractBugReport(transcript, attachment);

      case 'feature':
        return this.extractFeatureRequest(transcript, attachment);

      case 'auto':
      default:
        return this.autoAnalyze(transcript, attachment);
    }
  }

  private createTranscriptResult(
    transcript: string,
    attachment: { filename: string }
  ): AudioAnalysisOutput {
    return {
      attachmentId: '',
      mode: 'transcribe',
      success: true,
      result: {
        transcript,
        summary: `Transcription of "${attachment.filename}"`,
        detectedIntent: 'general',
        confidence: 0.85,
      },
    };
  }

  private extractRequirements(
    transcript: string,
    attachment: { filename: string }
  ): AudioAnalysisOutput {
    // Placeholder requirements extraction
    const requirements = [
      'Real-time notifications for mentions and replies',
      'Email digest options (daily/weekly)',
      'Customizable notification preferences',
      'Mobile push notification support',
    ];

    const suggestedTasks: SuggestedTask[] = [
      { label: 'Implement WebSocket notification system', type: 'feature', priority: 'high' },
      { label: 'Create email digest scheduler', type: 'feature', priority: 'medium' },
      { label: 'Build notification preferences UI', type: 'feature', priority: 'medium' },
      { label: 'Integrate push notification service', type: 'feature', priority: 'medium' },
    ];

    return {
      attachmentId: '',
      mode: 'requirements',
      success: true,
      result: {
        transcript,
        summary: `Requirements extracted from "${attachment.filename}"`,
        requirements,
        suggestedTasks,
        detectedIntent: 'feature',
        confidence: 0.8,
      },
    };
  }

  private extractBugReport(
    transcript: string,
    attachment: { filename: string }
  ): AudioAnalysisOutput {
    const bugReport: BugReport = {
      summary: 'Login validation fails with special characters in password',
      stepsToReproduce: [
        'Go to login page',
        'Enter email address',
        'Enter password containing @ or # characters',
        'Click submit',
      ],
      expectedBehavior: 'Form should accept valid passwords with special characters',
      actualBehavior: 'Form validation fails and shows error message',
      severity: 'high',
      affectedArea: 'Authentication',
    };

    const suggestedTasks: SuggestedTask[] = [
      { label: 'Fix password validation regex', type: 'bug', priority: 'high' },
      { label: 'Add e2e test for special character passwords', type: 'test', priority: 'medium' },
      { label: 'Update validation error message', type: 'bug', priority: 'low' },
    ];

    return {
      attachmentId: '',
      mode: 'bug',
      success: true,
      result: {
        transcript,
        summary: bugReport.summary,
        bugReport,
        suggestedTasks,
        detectedIntent: 'bug',
        confidence: 0.9,
      },
    };
  }

  private extractFeatureRequest(
    transcript: string,
    attachment: { filename: string }
  ): AudioAnalysisOutput {
    const userStories: UserStory[] = [
      {
        asA: 'project manager',
        iWant: 'to see a timeline view of all tasks',
        soThat: 'I can better understand project progress',
        acceptanceCriteria: [
          'Timeline displays all tasks chronologically',
          'Task dependencies are shown with arrows',
          'Blockers are highlighted in red',
          'Can zoom in/out on timeline',
        ],
      },
    ];

    const suggestedTasks: SuggestedTask[] = [
      { label: 'Design timeline component', type: 'feature', priority: 'medium' },
      { label: 'Implement task dependency visualization', type: 'feature', priority: 'medium' },
      { label: 'Add blocker highlighting', type: 'feature', priority: 'low' },
      { label: 'Create timeline zoom controls', type: 'feature', priority: 'low' },
    ];

    return {
      attachmentId: '',
      mode: 'feature',
      success: true,
      result: {
        transcript,
        summary: `Feature request: Timeline view for task management`,
        userStories,
        suggestedTasks,
        detectedIntent: 'feature',
        confidence: 0.85,
      },
    };
  }

  private autoAnalyze(
    transcript: string,
    attachment: { filename: string }
  ): AudioAnalysisOutput {
    // Auto-detect intent from transcript content
    const lowerTranscript = transcript.toLowerCase();

    if (lowerTranscript.includes('bug') || lowerTranscript.includes('error') || lowerTranscript.includes('fails')) {
      return this.extractBugReport(transcript, attachment);
    }

    if (lowerTranscript.includes('feature') || lowerTranscript.includes('want to') || lowerTranscript.includes('would like')) {
      return this.extractFeatureRequest(transcript, attachment);
    }

    if (lowerTranscript.includes('requirement') || lowerTranscript.includes('should') || lowerTranscript.includes('must')) {
      return this.extractRequirements(transcript, attachment);
    }

    // Default: just transcribe
    return this.createTranscriptResult(transcript, attachment);
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Manually trigger analysis for an audio attachment
   */
  async analyzeAttachment(
    attachmentId: string,
    projectId: string,
    mode: AudioAnalysisMode = 'auto'
  ): Promise<AudioAnalysisOutput> {
    return this.analyze({
      attachmentId,
      projectId,
      mode,
    });
  }

  /**
   * Stop the processing loop
   */
  stop() {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('[161.1][AUDIO_AGENT] Stopped');
  }

  /**
   * Check if agent is running
   */
  isRunning(): boolean {
    return this.running;
  }
}

console.log('[161.1][AUDIO_AGENT] Module loaded');
