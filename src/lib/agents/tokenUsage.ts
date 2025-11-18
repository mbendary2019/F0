// src/lib/agents/tokenUsage.ts
// Phase 77: Token Usage Tracking

import { doc, setDoc, getDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type TokenProvider = 'openai' | 'local' | 'claude';

export interface TokenUsageRecord {
  projectId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  provider: TokenProvider;
}

export interface DailyUsage {
  date: string;
  openai_tokens: number;
  local_tokens: number;
  claude_tokens: number;
  calls_count: number;
  lastUpdatedAt: any;
}

export interface MonthlyUsage {
  month: string;
  openai_tokens: number;
  local_tokens: number;
  claude_tokens: number;
  calls_count: number;
  lastResetAt: any;
}

/**
 * Get current date in ISO format (yyyy-mm-dd)
 */
function getISODate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get current month in ISO format (yyyy-mm)
 */
function getISOMonth(): string {
  const now = new Date();
  return now.toISOString().slice(0, 7);
}

/**
 * Record token usage for a project (daily + monthly aggregation)
 */
export async function recordTokenUsage(record: TokenUsageRecord): Promise<void> {
  const { projectId, model, inputTokens, outputTokens, provider } = record;
  const total = inputTokens + outputTokens;

  if (total === 0) return; // Skip if no tokens used

  console.log(`[Token Usage] Project ${projectId}: ${total} tokens (${provider})`);

  // Update daily usage
  const today = getISODate();
  const dailyRef = doc(db, 'ai_usage', projectId, 'daily', today);

  await setDoc(
    dailyRef,
    {
      date: today,
      openai_tokens: provider === 'openai' ? increment(total) : increment(0),
      local_tokens: provider === 'local' ? increment(total) : increment(0),
      claude_tokens: provider === 'claude' ? increment(total) : increment(0),
      calls_count: increment(1),
      lastUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Update monthly usage
  const month = getISOMonth();
  const monthlyRef = doc(db, 'ai_usage', projectId, 'monthly', month);

  await setDoc(
    monthlyRef,
    {
      month,
      openai_tokens: provider === 'openai' ? increment(total) : increment(0),
      local_tokens: provider === 'local' ? increment(total) : increment(0),
      claude_tokens: provider === 'claude' ? increment(total) : increment(0),
      calls_count: increment(1),
      lastResetAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Get daily usage for a project
 */
export async function getDailyUsage(projectId: string, date?: string): Promise<DailyUsage | null> {
  const targetDate = date || getISODate();
  const dailyRef = doc(db, 'ai_usage', projectId, 'daily', targetDate);

  try {
    const snap = await getDoc(dailyRef);
    if (!snap.exists()) {
      return {
        date: targetDate,
        openai_tokens: 0,
        local_tokens: 0,
        claude_tokens: 0,
        calls_count: 0,
        lastUpdatedAt: null,
      };
    }

    return snap.data() as DailyUsage;
  } catch (error) {
    console.error('[Token Usage] Failed to get daily usage:', error);
    return null;
  }
}

/**
 * Get monthly usage for a project
 */
export async function getMonthlyUsage(projectId: string, month?: string): Promise<MonthlyUsage | null> {
  const targetMonth = month || getISOMonth();
  const monthlyRef = doc(db, 'ai_usage', projectId, 'monthly', targetMonth);

  try {
    const snap = await getDoc(monthlyRef);
    if (!snap.exists()) {
      return {
        month: targetMonth,
        openai_tokens: 0,
        local_tokens: 0,
        claude_tokens: 0,
        calls_count: 0,
        lastResetAt: null,
      };
    }

    return snap.data() as MonthlyUsage;
  } catch (error) {
    console.error('[Token Usage] Failed to get monthly usage:', error);
    return null;
  }
}

/**
 * Get total tokens used today
 */
export async function getTotalDailyTokens(projectId: string): Promise<number> {
  const usage = await getDailyUsage(projectId);
  if (!usage) return 0;

  return usage.openai_tokens + usage.local_tokens + usage.claude_tokens;
}

/**
 * Get total tokens used this month
 */
export async function getTotalMonthlyTokens(projectId: string): Promise<number> {
  const usage = await getMonthlyUsage(projectId);
  if (!usage) return 0;

  return usage.openai_tokens + usage.local_tokens + usage.claude_tokens;
}

/**
 * Estimate token count from text (rough approximation)
 * 1 token ≈ 4 characters for English
 * 1 token ≈ 2-3 characters for Arabic
 */
export function estimateTokens(text: string): number {
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const charsPerToken = hasArabic ? 2.5 : 4;
  return Math.ceil(text.length / charsPerToken);
}
