/**
 * Phase 109.6: Unified AI Logs + Activity System
 *
 * Central logging for all AI operations:
 * - Desktop IDE
 * - Web IDE
 * - Auto Executor
 * - Cloud Agent
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebaseAdmin';
import { cleanFirestoreData } from '@/lib/server/actions';

const db = adminDb;

// Origin types for all AI operations
export type AiLogOrigin = 'desktop-ide' | 'web-ide' | 'auto-executor' | 'cloud-agent';

// Mode types
export type AiLogMode = 'chat' | 'refactor' | 'task' | 'plan' | 'explain';

/**
 * AI Log entry structure
 */
export interface AiLogEntry {
  origin: AiLogOrigin;
  projectId: string;
  mode: AiLogMode;
  success: boolean;
  taskId?: string; // Phase 93.6: Link to task for execution tracking
  filePath?: string;
  summary?: string;
  message?: string;
  userPromptPreview?: string; // Phase 93.6: Preview of user prompt
  errorMessage?: string;
  uid?: string;
  status?: 'pending' | 'success' | 'error'; // Phase 93.6: Status for task logs
  metadata?: Record<string, any>;
}

/**
 * Activity entry structure
 */
export interface ActivityEntry {
  projectId: string;
  origin: AiLogOrigin;
  type: string;
  description: string;
  filePath?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an AI event to ops_aiLogs collection
 */
export async function logAiEvent(entry: AiLogEntry): Promise<string | null> {
  try {
    // Clean undefined values before sending to Firestore
    const cleanedEntry = cleanFirestoreData({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
    const docRef = await db.collection('ops_aiLogs').add(cleanedEntry);

    console.log(`[AI Logs] ${entry.origin}/${entry.mode}: ${entry.success ? '✅' : '❌'} ${entry.summary || entry.message || ''}`);

    return docRef.id;
  } catch (err) {
    console.warn('[AI Logs] Failed to log event:', err);
    return null;
  }
}

/**
 * Log an activity event to ops_activity collection
 */
export async function logActivity(entry: ActivityEntry): Promise<string | null> {
  try {
    // Clean undefined values before sending to Firestore
    const cleanedEntry = cleanFirestoreData({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
    const docRef = await db.collection('ops_activity').add(cleanedEntry);

    console.log(`[Activity] ${entry.origin}: ${entry.description}`);

    return docRef.id;
  } catch (err) {
    console.warn('[Activity] Failed to log event:', err);
    return null;
  }
}

/**
 * Log both AI event and activity together (common pattern)
 */
export async function logAiOperation(params: {
  origin: AiLogOrigin;
  projectId: string;
  mode: AiLogMode;
  success: boolean;
  taskId?: string; // Phase 93.6: Link to task
  filePath?: string;
  summary?: string;
  message?: string;
  userPromptPreview?: string; // Phase 93.6: Preview of user prompt
  errorMessage?: string;
  uid?: string;
  status?: 'pending' | 'success' | 'error'; // Phase 93.6: Status for task logs
  metadata?: Record<string, any>;
}): Promise<void> {
  const { origin, projectId, mode, success, taskId, filePath, summary, message, userPromptPreview, errorMessage, uid, status, metadata } = params;

  // Log to ops_aiLogs
  await logAiEvent({
    origin,
    projectId,
    mode,
    success,
    taskId,
    filePath,
    summary,
    message,
    userPromptPreview,
    errorMessage,
    uid,
    status,
    metadata,
  });

  // Log to ops_activity (if successful)
  if (success) {
    const description = summary || message || `${mode} operation via ${origin}`;
    await logActivity({
      projectId,
      origin,
      type: mode,
      description,
      filePath,
      metadata,
    });
  }
}

/**
 * Get origin icon for display
 */
export function getOriginIcon(origin: AiLogOrigin): string {
  switch (origin) {
    case 'desktop-ide':
      return '💻';
    case 'web-ide':
      return '🏠';
    case 'auto-executor':
      return '🤖';
    case 'cloud-agent':
      return '☁️';
    default:
      return '📝';
  }
}

/**
 * Get origin display name
 */
export function getOriginLabel(origin: AiLogOrigin): string {
  switch (origin) {
    case 'desktop-ide':
      return 'Desktop IDE';
    case 'web-ide':
      return 'Web IDE';
    case 'auto-executor':
      return 'Auto Executor';
    case 'cloud-agent':
      return 'Cloud Agent';
    default:
      return origin;
  }
}
