// src/components/agents/ProjectChatPanel.tsx
// =============================================================================
// Phase 157.4 + 158.3 + 160.3 + 161.3 + 162 – Project Chat Panel with Media Chat
// Chat interface for conversational project interaction
// =============================================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Send,
  Loader2,
  Bot,
  User,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Zap,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  Music,
  File,
  Eye,
  Scan,
  Mic,
  ListTodo,
  Bug,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'pdf' | 'document' | 'audio' | 'other';
  downloadUrl?: string;
}

interface ConversationTurn {
  id: string;
  threadId: string;
  projectId: string;
  authorRole: 'user' | 'assistant' | 'system';
  authorId?: string;
  content: string;
  createdAt: string;
  planId?: string;
  attachments?: string[];
  metadata?: {
    intent?: 'question' | 'command' | 'feedback';
  };
}

interface ConversationThread {
  id: string;
  projectId: string;
  title: string;
  createdBy: string;
  createdAt: string;
  lastMessageAt: string;
  turnCount?: number;
  activePlanId?: string;
}

interface ProjectChatPanelProps {
  projectId: string;
  userId?: string;
  userMode?: 'beginner' | 'pro' | 'expert';
  className?: string;
  onPlanTriggered?: (planId: string) => void;

  // Phase 162: Media Chat mode
  mediaMode?: boolean;
  focusAttachment?: Attachment;
  onExitMediaMode?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function ProjectChatPanel({
  projectId,
  userId,
  userMode = 'pro',
  className = '',
  onPlanTriggered,
  mediaMode = false,
  focusAttachment,
  onExitMediaMode,
}: ProjectChatPanelProps) {
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 158: Attachments
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Phase 160: Media Analysis
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch conversation history
  const fetchHistory = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/agents/chat?projectId=${projectId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch chat history');
      }

      setThread(data.latestThread || null);
      setTurns(data.latestTurns || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[157.4][CHAT] Error fetching history:', message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial fetch
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Scroll when turns change
  useEffect(() => {
    scrollToBottom();
  }, [turns, scrollToBottom]);

  // Phase 158: Handle file upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('projectId', projectId);
        formData.append('file', file);
        if (thread?.id) {
          formData.append('conversationId', thread.id);
        }
        if (userId) {
          formData.append('userId', userId);
        }

        const res = await fetch('/api/attachments/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to upload file');
        }

        setPendingAttachments((prev) => [...prev, data.attachment]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      console.error('[158.3][CHAT] Upload error:', message);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove pending attachment
  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Phase 160: Analyze attachment
  const handleAnalyze = async (attachment: Attachment, analysisType: 'describe' | 'ocr' = 'describe') => {
    if (analyzing) return;

    setAnalyzing(attachment.id);
    setError(null);

    try {
      const res = await fetch('/api/media/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachmentId: attachment.id,
          projectId,
          analysisType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Add analysis result as an assistant message
      if (data.success && data.result) {
        const analysisContent = analysisType === 'describe'
          ? `**Image Analysis for "${attachment.filename}":**\n\n${data.result.description || 'No description available'}`
          : `**OCR Result for "${attachment.filename}":**\n\n${data.result.text || 'No text detected'}`;

        const analysisTurn: ConversationTurn = {
          id: `analysis_${Date.now()}`,
          threadId: thread?.id || '',
          projectId,
          authorRole: 'assistant',
          content: analysisContent,
          createdAt: new Date().toISOString(),
          metadata: { intent: 'feedback' },
        };
        setTurns((prev) => [...prev, analysisTurn]);
      }

      console.log('[160.3][CHAT] Analysis complete:', data.analysisType);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
      console.error('[160.3][CHAT] Analysis error:', message);
    } finally {
      setAnalyzing(null);
    }
  };

  // Phase 161: Audio analysis handler
  const handleAudioAnalyze = async (
    attachment: Attachment,
    mode: 'transcribe' | 'requirements' | 'bug' | 'feature' = 'transcribe'
  ) => {
    if (analyzing) return;

    setAnalyzing(attachment.id);
    setError(null);

    try {
      const res = await fetch('/api/audio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachmentId: attachment.id,
          projectId,
          mode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Audio analysis failed');
      }

      // Add analysis result as an assistant message
      if (data.success && data.result) {
        let analysisContent = '';

        switch (mode) {
          case 'transcribe':
            analysisContent = `**Transcription of "${attachment.filename}":**\n\n${data.result.transcript || 'No transcript available'}`;
            break;
          case 'requirements':
            analysisContent = `**Requirements from "${attachment.filename}":**\n\n`;
            if (data.result.requirements?.length) {
              analysisContent += data.result.requirements.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n');
            }
            if (data.result.suggestedTasks?.length) {
              analysisContent += `\n\n**Suggested Tasks:**\n`;
              analysisContent += data.result.suggestedTasks.map((t: { label: string; type: string }) => `- [${t.type}] ${t.label}`).join('\n');
            }
            break;
          case 'bug':
            const bug = data.result.bugReport;
            analysisContent = `**Bug Report from "${attachment.filename}":**\n\n`;
            analysisContent += `**Summary:** ${bug?.summary || data.result.summary}\n\n`;
            if (bug?.stepsToReproduce?.length) {
              analysisContent += `**Steps to Reproduce:**\n${bug.stepsToReproduce.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}\n\n`;
            }
            if (bug?.expectedBehavior) {
              analysisContent += `**Expected:** ${bug.expectedBehavior}\n`;
            }
            if (bug?.actualBehavior) {
              analysisContent += `**Actual:** ${bug.actualBehavior}\n`;
            }
            if (data.result.suggestedTasks?.length) {
              analysisContent += `\n**Suggested Fixes:**\n`;
              analysisContent += data.result.suggestedTasks.map((t: { label: string; priority?: string }) => `- ${t.label}${t.priority ? ` (${t.priority})` : ''}`).join('\n');
            }
            break;
          case 'feature':
            analysisContent = `**Feature Request from "${attachment.filename}":**\n\n`;
            analysisContent += `${data.result.summary || ''}\n\n`;
            if (data.result.userStories?.length) {
              analysisContent += `**User Stories:**\n`;
              data.result.userStories.forEach((story: { asA: string; iWant: string; soThat: string }) => {
                analysisContent += `- As a ${story.asA}, I want ${story.iWant}, so that ${story.soThat}\n`;
              });
            }
            if (data.result.suggestedTasks?.length) {
              analysisContent += `\n**Suggested Tasks:**\n`;
              analysisContent += data.result.suggestedTasks.map((t: { label: string; type: string }) => `- [${t.type}] ${t.label}`).join('\n');
            }
            break;
        }

        const analysisTurn: ConversationTurn = {
          id: `audio_${Date.now()}`,
          threadId: thread?.id || '',
          projectId,
          authorRole: 'assistant',
          content: analysisContent,
          createdAt: new Date().toISOString(),
          metadata: { intent: 'feedback' },
        };
        setTurns((prev) => [...prev, analysisTurn]);
      }

      console.log('[161.3][CHAT] Audio analysis complete:', data.mode);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Audio analysis failed';
      setError(message);
      console.error('[161.3][CHAT] Audio analysis error:', message);
    } finally {
      setAnalyzing(null);
    }
  };

  // Send message
  const sendMessage = async () => {
    if ((!input.trim() && pendingAttachments.length === 0) || sending) return;

    const messageContent = input.trim();
    const attachmentIds = pendingAttachments.map((a) => a.id);

    setInput('');
    setPendingAttachments([]);
    setSending(true);

    // Optimistic update
    const optimisticTurn: ConversationTurn = {
      id: `optimistic_${Date.now()}`,
      threadId: thread?.id || '',
      projectId,
      authorRole: 'user',
      authorId: userId,
      content: messageContent || (attachmentIds.length > 0 ? `[${attachmentIds.length} file(s) attached]` : ''),
      createdAt: new Date().toISOString(),
      attachments: attachmentIds,
    };
    setTurns((prev) => [...prev, optimisticTurn]);

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId,
          threadId: thread?.id,
          content: messageContent,
          attachments: attachmentIds,
          userMode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Update with actual response
      setTurns(data.turns || []);

      // Check if plan was triggered
      const lastTurn = data.turns?.[data.turns.length - 1];
      if (lastTurn?.planId && onPlanTriggered) {
        onPlanTriggered(lastTurn.planId);
      }

      // Update thread if new
      if (data.threadId && !thread) {
        fetchHistory();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[157.4][CHAT] Error sending message:', message);

      // Remove optimistic update on error
      setTurns((prev) => prev.filter((t) => t.id !== optimisticTurn.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get intent badge
  const getIntentBadge = (turn: ConversationTurn) => {
    if (!turn.metadata?.intent) return null;

    const styles = {
      command: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30',
      question: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      feedback: 'bg-green-500/20 text-green-400 border-green-500/30',
    };

    const icons = {
      command: <Zap className="h-3 w-3" />,
      question: <MessageSquare className="h-3 w-3" />,
      feedback: <Sparkles className="h-3 w-3" />,
    };

    return (
      <Badge
        variant="outline"
        className={cn('text-[10px] h-5', styles[turn.metadata.intent])}
      >
        {icons[turn.metadata.intent]}
        <span className="ml-1">{turn.metadata.intent}</span>
      </Badge>
    );
  };

  // Get attachment icon based on kind
  const getAttachmentIcon = (kind: Attachment['kind']) => {
    switch (kind) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'pdf':
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'audio':
        return <Music className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // =============================================================================
  // Render
  // =============================================================================

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('flex flex-col', className)}>
      {/* Header */}
      <CardHeader className="pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            {mediaMode ? (
              <>
                <MessageCircle className="h-4 w-4 text-fuchsia-500" />
                <span className="truncate max-w-[150px]">
                  Chat: {focusAttachment?.filename || 'Media'}
                </span>
                <Badge variant="outline" className="text-[10px] bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30">
                  {focusAttachment?.kind}
                </Badge>
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 text-fuchsia-500" />
                Project Chat
                {thread && (
                  <Badge variant="outline" className="text-[10px] ml-2">
                    {thread.turnCount || 0} messages
                  </Badge>
                )}
              </>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            {mediaMode && onExitMediaMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExitMediaMode}
                className="h-8 text-xs"
              >
                <X className="h-4 w-4 mr-1" />
                Exit
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchHistory}
              className="h-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[500px]">
        {error && (
          <div className="text-sm text-red-500 text-center py-2">
            {error}
          </div>
        )}

        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
            <Bot className="h-12 w-12 mb-4 text-fuchsia-500/50" />
            <p className="text-sm mb-2">No messages yet</p>
            <p className="text-xs max-w-[250px]">
              {mediaMode && focusAttachment ? (
                <>Ask questions about <strong>{focusAttachment.filename}</strong>. Example: "What is in this {focusAttachment.kind}?" or "Describe the main elements."</>
              ) : (
                <>Start a conversation! Ask questions about your project or tell me what you want to build.</>
              )}
            </p>
          </div>
        ) : (
          <>
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={cn(
                  'flex gap-3',
                  turn.authorRole === 'user' ? 'flex-row-reverse' : ''
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                    turn.authorRole === 'user'
                      ? 'bg-fuchsia-500/20'
                      : 'bg-slate-700'
                  )}
                >
                  {turn.authorRole === 'user' ? (
                    <User className="h-4 w-4 text-fuchsia-400" />
                  ) : (
                    <Bot className="h-4 w-4 text-slate-400" />
                  )}
                </div>

                {/* Message */}
                <div
                  className={cn(
                    'flex-1 max-w-[80%]',
                    turn.authorRole === 'user' ? 'text-right' : ''
                  )}
                >
                  <div
                    className={cn(
                      'inline-block p-3 rounded-lg text-sm whitespace-pre-wrap',
                      turn.authorRole === 'user'
                        ? 'bg-fuchsia-500/20 text-fuchsia-50'
                        : 'bg-slate-800 text-slate-100'
                    )}
                  >
                    {turn.content}
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-2 mt-1',
                      turn.authorRole === 'user' ? 'justify-end' : ''
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(turn.createdAt)}
                    </span>
                    {getIntentBadge(turn)}
                    {turn.planId && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 bg-purple-500/20 text-purple-400 border-purple-500/30"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Plan
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Sending indicator */}
            {sending && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-700">
                  <Bot className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      {/* Input */}
      <div className="border-t border-slate-800 p-4">
        {/* Pending Attachments */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {pendingAttachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs"
              >
                {getAttachmentIcon(att.kind)}
                <span className="max-w-[100px] truncate">{att.filename}</span>
                <span className="text-muted-foreground">
                  ({formatFileSize(att.sizeBytes)})
                </span>
                {/* Phase 160: Analyze buttons for images */}
                {att.kind === 'image' && (
                  <>
                    <button
                      onClick={() => handleAnalyze(att, 'describe')}
                      disabled={analyzing === att.id}
                      className="text-fuchsia-400 hover:text-fuchsia-300 disabled:opacity-50"
                      title="Describe image"
                    >
                      {analyzing === att.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => handleAnalyze(att, 'ocr')}
                      disabled={analyzing === att.id}
                      className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      title="Extract text (OCR)"
                    >
                      <Scan className="h-3 w-3" />
                    </button>
                  </>
                )}
                {/* Phase 161: Analyze buttons for audio */}
                {att.kind === 'audio' && (
                  <>
                    <button
                      onClick={() => handleAudioAnalyze(att, 'transcribe')}
                      disabled={analyzing === att.id}
                      className="text-purple-400 hover:text-purple-300 disabled:opacity-50"
                      title="Transcribe audio"
                    >
                      {analyzing === att.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Mic className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      onClick={() => handleAudioAnalyze(att, 'requirements')}
                      disabled={analyzing === att.id}
                      className="text-green-400 hover:text-green-300 disabled:opacity-50"
                      title="Extract requirements"
                    >
                      <ListTodo className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleAudioAnalyze(att, 'bug')}
                      disabled={analyzing === att.id}
                      className="text-red-400 hover:text-red-300 disabled:opacity-50"
                      title="Extract bug report"
                    >
                      <Bug className="h-3 w-3" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => removePendingAttachment(att.id)}
                  className="text-slate-400 hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* File Input (hidden) */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/plain,text/markdown,audio/*,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex gap-2">
          {/* Attach Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending}
            className="flex-shrink-0"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>

          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mediaMode && focusAttachment
                ? `Ask about "${focusAttachment.filename}"...`
                : 'Ask about your project or describe what to build...'
            }
            className="flex-1 bg-slate-900 border-slate-700"
            disabled={sending}
          />
          <Button
            onClick={sendMessage}
            disabled={(!input.trim() && pendingAttachments.length === 0) || sending}
            className="bg-fuchsia-600 hover:bg-fuchsia-700"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setInput('What can you help me with?')}
          >
            Help
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setInput('Show me the project status')}
          >
            Status
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setInput('Add a new feature: ')}
          >
            Add Feature
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setInput('Fix the bug in: ')}
          >
            Fix Bug
          </Button>
        </div>
      </div>
    </Card>
  );
}

console.log('[162][UI] ProjectChatPanel loaded with Media Chat support');
