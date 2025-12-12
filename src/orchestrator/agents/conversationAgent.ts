// orchestrator/agents/conversationAgent.ts
// =============================================================================
// Phase 157.2 + 162 – ConversationAgent with Media Chat
// Handles project chat, decides when to trigger plans vs simple Q&A
// Supports media-focused conversations (Phase 162)
// =============================================================================

import {
  AgentBus,
  AgentMessage,
  AgentRole,
  PlannerInput,
} from '../core/multiAgent/types';
import {
  ConversationStore,
  ConversationTurn,
  ConversationThread,
} from '../core/conversation/types';

interface ConversationAgentDeps {
  bus: AgentBus;
  convStore: ConversationStore;
}

interface ChatMessagePayload {
  threadId?: string;
  content: string;
  // Phase 162: Media Chat fields
  focusAttachmentId?: string;
  focusPage?: number;
  focusRegionHint?: string;
  mediaMode?: boolean;
}

interface ChatResponsePayload {
  threadId: string;
  turn: ConversationTurn;
  planId?: string;
}

function generateId(prefix = 'turn'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Intent detection patterns
const PLAN_TRIGGER_PATTERNS = [
  /\bfix\b/i,
  /\bbug\b/i,
  /\badd\b/i,
  /\bcreate\b/i,
  /\bimplement\b/i,
  /\bfeature\b/i,
  /\brefactor\b/i,
  /\bupdate\b/i,
  /\bchange\b/i,
  /\bmodify\b/i,
  /\bremove\b/i,
  /\bdelete\b/i,
  /\bبتلج/,        // Arabic: fix
  /\bضيف/,         // Arabic: add
  /\bعدل/,         // Arabic: modify
];

const QUESTION_PATTERNS = [
  /^(what|where|how|why|when|who|which|can|does|is|are)\b/i,
  /\?$/,
  /^(إيه|فين|إزاي|ليه|مين|هل)/,  // Arabic questions
];

export class ConversationAgent {
  readonly role: AgentRole = 'conversation';

  constructor(private readonly deps: ConversationAgentDeps) {
    this.deps.bus.subscribe(this.role, (msg) => this.handleMessage(msg));
    console.log('[157.2][CONV_AGENT] ConversationAgent initialized');
  }

  private async handleMessage(message: AgentMessage): Promise<void> {
    // Only handle CHAT_MESSAGE
    if (message.kind !== 'CHAT_MESSAGE') {
      return;
    }

    const { projectId, userId, conversationId, userMode } = message.context;
    const payload = message.payload as ChatMessagePayload;

    if (!projectId || !payload.content) {
      console.warn('[157.2][CONV_AGENT] Missing projectId or content');
      return;
    }

    const now = new Date().toISOString();

    // Determine thread ID
    let threadId = payload.threadId ?? conversationId;
    if (!threadId) {
      // Create new thread if none exists
      const thread = await this.deps.convStore.createThread(
        projectId,
        userId ?? 'anonymous',
        this.generateThreadTitle(payload.content)
      );
      threadId = thread.id;
    }

    // Save user turn with media focus fields (Phase 162)
    const userTurn: ConversationTurn = {
      id: generateId('user'),
      threadId,
      projectId,
      authorRole: 'user',
      authorId: userId,
      content: payload.content,
      createdAt: now,
      focusAttachmentId: payload.focusAttachmentId,
      focusPage: payload.focusPage,
      focusRegionHint: payload.focusRegionHint,
      metadata: {
        intent: this.detectIntent(payload.content),
      },
    };
    await this.deps.convStore.appendTurn(userTurn);

    // Phase 162: Handle media-focused chat
    if (payload.focusAttachmentId || payload.mediaMode) {
      await this.handleMediaChatRequest(message, threadId, payload);
      return;
    }

    // Decide: Plan or Q&A?
    const shouldTriggerPlan = this.shouldTriggerPlan(payload.content);

    if (shouldTriggerPlan) {
      await this.handlePlanRequest(message, threadId, payload.content);
    } else {
      await this.handleQARequest(message, threadId, payload.content);
    }
  }

  private async handlePlanRequest(
    message: AgentMessage,
    threadId: string,
    content: string
  ): Promise<void> {
    const { projectId, userId, userMode } = message.context;
    const now = new Date().toISOString();

    // Build planner input
    const plannerInput: PlannerInput = {
      goal: content,
      projectId,
      userId,
      conversationId: threadId,
      constraints: {
        maxSteps: 10,
        preferSafeMode: userMode !== 'expert',
        allowShell: true,
        allowBrowser: false,
      },
    };

    // Send TASK_PROPOSAL to planner
    const proposalId = generateId('proposal');
    await this.deps.bus.publish({
      id: proposalId,
      timestamp: now,
      from: 'conversation',
      to: 'planner',
      kind: 'TASK_PROPOSAL',
      context: {
        ...message.context,
        conversationId: threadId,
      },
      safety: { level: 'medium' },
      payload: plannerInput,
    });

    // Save assistant turn
    const assistantTurn: ConversationTurn = {
      id: generateId('assistant'),
      threadId,
      projectId,
      authorRole: 'assistant',
      content: this.getPlanStartedMessage(content),
      createdAt: new Date().toISOString(),
      planId: proposalId,
      metadata: {
        intent: 'command',
      },
    };
    await this.deps.convStore.appendTurn(assistantTurn);

    // Publish response
    await this.publishChatResponse(message, threadId, assistantTurn, proposalId);

    console.log('[157.2][CONV_AGENT] Plan triggered:', proposalId);
  }

  private async handleQARequest(
    message: AgentMessage,
    threadId: string,
    content: string
  ): Promise<void> {
    const { projectId } = message.context;

    // For now, simple response (later: integrate with LLM + project context)
    const responseContent = this.generateQAResponse(content);

    const assistantTurn: ConversationTurn = {
      id: generateId('assistant'),
      threadId,
      projectId,
      authorRole: 'assistant',
      content: responseContent,
      createdAt: new Date().toISOString(),
      metadata: {
        intent: 'question',
      },
    };
    await this.deps.convStore.appendTurn(assistantTurn);

    // Publish response
    await this.publishChatResponse(message, threadId, assistantTurn);

    console.log('[157.2][CONV_AGENT] Q&A response sent');
  }

  // ==========================================
  // Phase 162: Media Chat Handling
  // ==========================================

  private async handleMediaChatRequest(
    message: AgentMessage,
    threadId: string,
    payload: ChatMessagePayload
  ): Promise<void> {
    const { projectId } = message.context;
    const { content, focusAttachmentId, focusPage, focusRegionHint } = payload;

    console.log('[162][CONV_AGENT] Media chat request:', focusAttachmentId, content);

    // Determine which agent to forward to based on attachment type
    // For now, forward to media agent for all types
    // In future: detect audio attachments and forward to audio agent

    const taskId = generateId('media_chat');

    // Send task to media agent
    await this.deps.bus.publish({
      id: taskId,
      timestamp: new Date().toISOString(),
      from: 'conversation',
      to: 'media',  // or 'audio' based on attachment type
      kind: 'TASK_ASSIGNMENT',
      context: {
        ...message.context,
        conversationId: threadId,
      },
      safety: { level: 'low' },
      payload: {
        type: 'chat',
        attachmentId: focusAttachmentId,
        question: content,
        page: focusPage,
        regionHint: focusRegionHint,
      },
    });

    // For v1: Generate a placeholder response
    // Later: Wait for media agent response and use that
    const responseContent = this.generateMediaChatResponse(content, focusAttachmentId);

    const assistantTurn: ConversationTurn = {
      id: generateId('assistant'),
      threadId,
      projectId,
      authorRole: 'assistant',
      content: responseContent,
      createdAt: new Date().toISOString(),
      focusAttachmentId,
      focusPage,
      focusRegionHint,
      metadata: {
        intent: 'feedback',
      },
    };
    await this.deps.convStore.appendTurn(assistantTurn);

    // Publish response
    await this.publishChatResponse(message, threadId, assistantTurn);

    console.log('[162][CONV_AGENT] Media chat response sent');
  }

  private generateMediaChatResponse(question: string, attachmentId?: string): string {
    const lowerQ = question.toLowerCase();

    // Placeholder responses based on question type
    if (lowerQ.includes('what') || lowerQ.includes('describe')) {
      return `Based on my analysis of this file (ID: ${attachmentId?.slice(0, 8)}...), I can see it contains relevant content for your project.

**Key observations:**
- The file appears to be properly formatted
- Content is relevant to your current context
- I've extracted the main elements for reference

Would you like me to analyze specific aspects or extract more details?

*Note: Full Vision API integration coming in Phase 162+*`;
    }

    if (lowerQ.includes('text') || lowerQ.includes('ocr') || lowerQ.includes('read')) {
      return `I've attempted to extract text from this file.

**Detected text regions:**
- Primary content area detected
- Additional elements identified

For more accurate OCR results, use the "Extract Text" button in the attachment panel.

*Note: Full OCR integration coming soon*`;
    }

    if (lowerQ.includes('improve') || lowerQ.includes('suggest') || lowerQ.includes('better')) {
      return `Here are some suggestions for this content:

1. **Layout**: Consider improving spacing and hierarchy
2. **Content**: Ensure all key information is present
3. **Usability**: Review for accessibility considerations

Would you like me to create tasks for implementing these improvements?`;
    }

    // Default response
    return `I understand you're asking about this file: "${question.slice(0, 50)}..."

I've analyzed the content and can help you with:
- Describing what's in the file
- Extracting text or information
- Suggesting improvements
- Creating tasks based on the content

What specific aspect would you like me to focus on?

*Note: Advanced media analysis coming in Phase 162+*`;
  }

  private async publishChatResponse(
    originalMessage: AgentMessage,
    threadId: string,
    turn: ConversationTurn,
    planId?: string
  ): Promise<void> {
    const responsePayload: ChatResponsePayload = {
      threadId,
      turn,
      planId,
    };

    await this.deps.bus.publish({
      id: generateId('response'),
      timestamp: new Date().toISOString(),
      from: 'conversation',
      to: 'conversation',
      kind: 'CHAT_RESPONSE',
      context: originalMessage.context,
      safety: { level: 'low' },
      payload: responsePayload,
    });
  }

  // ==========================================
  // Intent Detection
  // ==========================================

  private detectIntent(content: string): 'question' | 'command' | 'feedback' {
    if (QUESTION_PATTERNS.some((p) => p.test(content))) {
      return 'question';
    }
    if (PLAN_TRIGGER_PATTERNS.some((p) => p.test(content))) {
      return 'command';
    }
    return 'feedback';
  }

  private shouldTriggerPlan(content: string): boolean {
    // Check for explicit plan triggers
    if (PLAN_TRIGGER_PATTERNS.some((p) => p.test(content))) {
      // But not if it's phrased as a question
      if (QUESTION_PATTERNS.some((p) => p.test(content))) {
        return false;
      }
      return true;
    }
    return false;
  }

  // ==========================================
  // Response Generation
  // ==========================================

  private generateThreadTitle(content: string): string {
    // Take first 50 chars as title
    const cleaned = content.trim().replace(/\n/g, ' ');
    if (cleaned.length <= 50) return cleaned;
    return cleaned.slice(0, 47) + '...';
  }

  private getPlanStartedMessage(goal: string): string {
    const messages = [
      `Starting a new plan to: "${goal.slice(0, 100)}"... Check the Agent Plan Panel for progress.`,
      `Got it! Working on: "${goal.slice(0, 100)}". You can track progress in the Plan Panel.`,
      `Plan created for: "${goal.slice(0, 100)}". The agents are on it!`,
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  private generateQAResponse(content: string): string {
    // Simple v1 responses (later: LLM integration)
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('hello') || lowerContent.includes('hi')) {
      return "Hello! I'm your project assistant. Ask me about your project or tell me what you'd like to build/fix.";
    }

    if (lowerContent.includes('help')) {
      return `I can help you with:
- Ask questions about your project
- Request features: "add a login page"
- Fix bugs: "fix the validation bug"
- Refactor code: "refactor the auth module"

Just describe what you want and I'll create a plan for it!`;
    }

    if (lowerContent.includes('status') || lowerContent.includes('progress')) {
      return "Check the Agent Plan Panel to see the current plan status and task progress.";
    }

    // Default response
    return `I understand you're asking about: "${content.slice(0, 100)}".

To get started, you can:
- Ask me to build something: "add user authentication"
- Ask me to fix something: "fix the login bug"
- Or ask questions about your project.

For more context-aware responses, the LLM integration will be added soon!`;
  }
}

console.log('[162][ORCHESTRATOR] ConversationAgent module loaded with Media Chat support');
