'use client';

/**
 * Phase 104.2: Agent Chat Panel for Continue Workspace
 * Handles conversation with F0 Agent and auto-processes JSON output
 */

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import type { AgentMessage } from '@/types/project';

interface AgentChatPanelProps {
  projectId: string;
  locale: 'ar' | 'en';
  useOpsCollection?: boolean; // Phase 93.5: write to ops_projects instead of projects
  initialPrompt?: string | null; // Phase 98.3.1: Pre-fill or auto-send prompt from template kickoff
  onInitialPromptConsumed?: () => void; // Phase 98.3.1: Callback when initialPrompt is used
}

/**
 * Strip F0_JSON blocks from message content for cleaner display
 */
function stripF0Json(text: string): string {
  if (!text) return '';
  // Remove [F0_JSON]...[/F0_JSON] blocks
  let cleaned = text.replace(/\[F0_JSON\][\s\S]*?\[\/F0_JSON\]/g, '').trim();
  // Also handle [FO_JSON] variant (typo protection)
  cleaned = cleaned.replace(/\[FO_JSON\][\s\S]*?\[\/FO_JSON\]/g, '').trim();
  return cleaned;
}

function AgentChatPanelInner({
  projectId,
  locale,
  useOpsCollection = false,
  initialPrompt,
  onInitialPromptConsumed,
}: AgentChatPanelProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSubmittingRef = useRef(false); // Prevent double submission
  const processedIdsRef = useRef<Set<string>>(new Set()); // Track processed message IDs across renders
  const listenerIdRef = useRef<number>(0); // Track listener instance

  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);

  // Phase 93.5: Choose collection based on toggle
  const collectionName = useMemo(() =>
    useOpsCollection ? 'ops_projects' : 'projects',
    [useOpsCollection]
  );

  // Real-time messages listener with proper cleanup
  useEffect(() => {
    if (!projectId) return;

    // Increment listener ID to track this specific listener instance
    const currentListenerId = ++listenerIdRef.current;
    console.log(`[AgentChat] Starting listener #${currentListenerId} for ${collectionName}/${projectId}`);

    const messagesRef = collection(db, collectionName, projectId, 'agent_messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Ignore callbacks from old listeners
      if (currentListenerId !== listenerIdRef.current) {
        console.log(`[AgentChat] Ignoring stale listener #${currentListenerId}`);
        return;
      }

      const msgs: AgentMessage[] = [];

      snapshot.forEach((docSnap) => {
        msgs.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as AgentMessage);
      });

      // Only update if we have messages or if clearing
      console.log(`[AgentChat] Listener #${currentListenerId} received ${msgs.length} messages`);
      setMessages(msgs);
    });

    return () => {
      console.log(`[AgentChat] Cleaning up listener #${currentListenerId}`);
      unsubscribe();
    };
  }, [projectId, collectionName]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Listen for streaming chunks from Code Agent
  useEffect(() => {
    const handleStreamChunk = (event: any) => {
      const { chunk } = event.detail;
      setIsStreaming(true);
      setStreamingContent((prev) => prev + chunk);
    };

    const handleStreamEnd = () => {
      setIsStreaming(false);
      setStreamingContent('');
    };

    window.addEventListener('code-agent-stream-chunk', handleStreamChunk);
    window.addEventListener('code-agent-stream-end', handleStreamEnd);

    return () => {
      window.removeEventListener('code-agent-stream-chunk', handleStreamChunk);
      window.removeEventListener('code-agent-stream-end', handleStreamEnd);
    };
  }, []);

  // Phase 98.3.1: Handle initial prompt from template kickoff
  // For "Start executing plan" - auto-send immediately
  // For "Customize plan" - pre-fill input so user can edit
  const initialPromptProcessedRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if no prompt or already processed this exact prompt
    if (!initialPrompt) return;
    if (initialPromptProcessedRef.current === initialPrompt) return;

    // Check if this is a "customize" prompt (has user-editable placeholder text)
    // Look for specific placeholder patterns, NOT [F0_JSON] tags
    const isCustomizePrompt =
      initialPrompt.includes('[اكتب') || // Arabic placeholder like [اكتب التعديلات هنا]
      initialPrompt.includes('[write') || // English placeholder like [write your changes here]
      initialPrompt.includes('[your') ||  // English placeholder like [your changes here]
      initialPrompt.includes('[أدخل');    // Arabic placeholder like [أدخل التعديلات]

    if (isCustomizePrompt) {
      // Pre-fill input for customization
      console.log('[AgentChat] Pre-filling input with customize prompt');
      setInput(initialPrompt);
      initialPromptProcessedRef.current = initialPrompt;
      onInitialPromptConsumed?.();
    } else {
      // Auto-send for "Start executing plan"
      // Don't auto-send if already loading/submitting
      if (loading || isSubmittingRef.current) {
        console.log('[AgentChat] Skipping auto-send - already in progress');
        return;
      }

      const autoSend = async () => {
        console.log('[AgentChat] Auto-sending initial prompt from template kickoff...');
        initialPromptProcessedRef.current = initialPrompt;
        isSubmittingRef.current = true;
        setLoading(true);

        try {
          const response = await fetch('/api/agent/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              intent: 'plan-board', // Use 'plan-board' intent for template kickoff
              message: initialPrompt,
              useOpsCollection, // Tell API which collection to use
            }),
          });

          const data = await response.json();
          console.log('[AgentChat] Auto-send response:', data);

          if (!data.ok) {
            console.error('[AgentChat] Auto-send error:', data.error);
          } else if (data.reply) {
            // Phase 98.3.1: Extract and process F0_JSON from agent response
            const agentReply = data.reply;
            const jsonMatch = agentReply.match(/\[F0_JSON\]([\s\S]*?)\[\/F0_JSON\]/);

            if (jsonMatch) {
              try {
                const f0Json = JSON.parse(jsonMatch[1]);
                console.log('[AgentChat] Extracted F0_JSON from auto-send:', f0Json);

                // Process the F0_JSON to create phases/tasks
                const processResponse = await fetch('/api/f0/process-json', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...f0Json,
                    useOpsCollection,
                  }),
                });

                if (processResponse.ok) {
                  const processData = await processResponse.json();
                  console.log('[AgentChat] F0_JSON processed:', processData);

                  // Add system message about successful processing
                  const messagesRef = collection(db, collectionName, projectId, 'agent_messages');
                  await addDoc(messagesRef, {
                    role: 'system',
                    content: locale === 'ar'
                      ? `✅ تم معالجة الخطة: ${processData.phasesCreated} مراحل، ${processData.tasksCreated} مهام تم إنشاؤها.`
                      : `✅ Plan processed: ${processData.phasesCreated} phases, ${processData.tasksCreated} tasks created.`,
                    createdAt: Date.now(),
                    lang: locale,
                  });
                } else {
                  console.error('[AgentChat] Failed to process F0_JSON');
                }
              } catch (parseErr) {
                console.error('[AgentChat] Failed to parse F0_JSON:', parseErr);
              }
            }
          }
        } catch (err) {
          console.error('[AgentChat] Auto-send failed:', err);
        } finally {
          setLoading(false);
          isSubmittingRef.current = false;
          onInitialPromptConsumed?.();
        }
      };

      autoSend();
    }
  }, [initialPrompt, projectId, loading, onInitialPromptConsumed]);

  // Send message to agent
  const handleSend = async () => {
    // Prevent double submission
    if (!input.trim() || loading || isSubmittingRef.current) {
      console.log('[AgentChat] Blocked - input:', !input.trim(), 'loading:', loading, 'submitting:', isSubmittingRef.current);
      return;
    }

    console.log('[AgentChat] Starting send...');
    isSubmittingRef.current = true;
    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    try {
      // NOTE: User message and agent reply are saved by /api/agent/run
      // We only call the API here - messages appear via real-time Firestore listener

      // 1. Call Agent API (it saves both user message and agent reply to Firestore)
      console.log('[AgentChat] Calling Agent API...');
      const response = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          intent: 'continue',
          message: userMessage,
          useOpsCollection, // Tell API which collection to use
        }),
      });

      if (!response.ok) {
        throw new Error(`Agent API failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok || !data.reply) {
        throw new Error('Invalid agent response');
      }

      const agentReply = data.reply;

      // 2. Extract [F0_JSON] if present (for processing phases/tasks)
      const jsonMatch = agentReply.match(/\[F0_JSON\]([\s\S]*?)\[\/F0_JSON\]/);

      let f0Json = null;

      if (jsonMatch) {
        try {
          f0Json = JSON.parse(jsonMatch[1]);
          console.log('[AgentChatPanel] Extracted F0_JSON:', f0Json);
        } catch (err) {
          console.error('[AgentChatPanel] Failed to parse F0_JSON:', err);
        }
      }

      // 3. Process F0_JSON if present (creates phases/tasks)
      if (f0Json) {
        console.log('[AgentChatPanel] Processing F0_JSON...');

        const processResponse = await fetch('/api/f0/process-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...f0Json,
            useOpsCollection, // Phase 93.5: tell API which collection to write to
          }),
        });

        if (processResponse.ok) {
          const processData = await processResponse.json();
          console.log('[AgentChatPanel] F0_JSON processed:', processData);

          // Add system message about successful processing
          const messagesRef = collection(db, collectionName, projectId, 'agent_messages');
          await addDoc(messagesRef, {
            role: 'system',
            content: t(
              `✅ Plan processed: ${processData.phasesCreated} phases, ${processData.tasksCreated} tasks created.`,
              `✅ تم معالجة الخطة: ${processData.phasesCreated} مراحل، ${processData.tasksCreated} مهام تم إنشاؤها.`
            ),
            createdAt: Date.now(),
            lang: locale,
          });
        } else {
          console.error('[AgentChatPanel] Failed to process F0_JSON');
        }
      }
    } catch (err: any) {
      console.error('[AgentChatPanel] Error:', err);

      // Add error message to chat
      const messagesRef = collection(db, collectionName, projectId, 'agent_messages');
      await addDoc(messagesRef, {
        role: 'system',
        content: t(
          `❌ Error: ${err.message}`,
          `❌ خطأ: ${err.message}`
        ),
        createdAt: Date.now(),
        lang: locale,
      });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false; // Reset submission lock
    }
  };

  // Use form submission instead of separate onClick/onKeyPress to avoid double firing
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages Area */}
      <div className="flex-1 min-h-0 p-6 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-gray-400 text-center py-20">
            <div className="text-4xl mb-4">💬</div>
            <div className="text-lg font-semibold mb-2">
              {t('Start a conversation', 'ابدأ محادثة')}
            </div>
            <div className="text-sm">
              {t(
                'Ask the agent to continue working on your project',
                'اطلب من الوكيل الاستمرار في العمل على مشروعك'
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              // Clean F0_JSON from display (safety net for old messages)
              const displayContent = msg.role === 'assistant'
                ? stripF0Json(msg.content)
                : msg.content;

              // Skip empty messages after stripping
              if (!displayContent?.trim()) return null;

              return (
                <div
                  key={msg.id || `${msg.createdAt}-${msg.role}`}
                  className={`flex ${
                    msg.role === 'user'
                      ? locale === 'ar'
                        ? 'justify-start'
                        : 'justify-end'
                      : locale === 'ar'
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-[#7b5cff] text-white'
                        : msg.role === 'system'
                        ? 'bg-[#2e1a57] text-gray-300 text-sm italic'
                        : 'bg-[#140a2e] text-white'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="text-xs text-gray-400 mb-1">
                        🤖 {t('F0 Agent', 'وكيل F0')}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{displayContent}</div>
                    {msg.metadata?.hasArchitectPlan && (
                      <div className="mt-2 text-xs text-purple-300">
                        📋 {t('Plan included', 'خطة مرفقة')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Streaming Message (like Cursor) */}
            {isStreaming && streamingContent && (
              <div className={`flex ${locale === 'ar' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-[#140a2e] text-white border-2 border-purple-500/50 animate-pulse">
                  <div className="text-xs text-gray-400 mb-1">
                    ⚡ {t('Code Agent (streaming...)', 'وكيل الكود (streaming...)')}
                  </div>
                  <div className="whitespace-pre-wrap font-mono text-sm">
                    {streamingContent}
                    <span className="inline-block w-2 h-4 bg-purple-500 ml-1 animate-pulse">|</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm mt-4">
            <div className="animate-spin">⏳</div>
            <div>{t('Agent is thinking...', 'الوكيل يفكر...')}</div>
          </div>
        )}
      </div>

      {/* Input Area - Using form to prevent double submission */}
      <form onSubmit={handleSubmit} className="border-t border-[#2c1466] p-4 flex-shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(
              'Type a message to the agent...',
              'اكتب رسالة للوكيل...'
            )}
            className="flex-1 bg-[#140a2e] border border-[#2c1466] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#7b5cff]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={`px-6 py-3 rounded-xl font-semibold transition ${
              loading || !input.trim()
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-[#7b5cff] hover:bg-[#6a4de6] text-white'
            }`}
          >
            {loading ? '...' : t('Send', 'إرسال')}
          </button>
        </div>
      </form>
    </div>
  );
}

// Wrap with React.memo to prevent unnecessary re-renders from parent state changes
const AgentChatPanel = memo(AgentChatPanelInner, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.projectId === nextProps.projectId &&
    prevProps.locale === nextProps.locale &&
    prevProps.useOpsCollection === nextProps.useOpsCollection
  );
});

export default AgentChatPanel;
