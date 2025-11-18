// src/lib/agents/recovery.ts
// Phase 79: Error Recovery & Self-Correction System - Recovery Engine

import { AgentError, AgentErrorType, toAgentError } from './errors';
import { Patch, PatchResult } from './patch/types';
import { parsePatch, extractPatchFromMarkdown } from './patch/parsePatch';
import { applyPatch } from './patch/applyPatch';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_RETRY_ATTEMPTS = 3;

export interface RecoveryContext {
  originalRequest: string;
  originalResponse: string;
  error: AgentError;
  attempt: number;
  maxAttempts: number;
  locale: 'ar' | 'en';
  projectId?: string;
}

export interface RecoveryResult {
  success: boolean;
  correctedResponse?: string;
  patch?: Patch;
  patchResult?: PatchResult;
  error?: AgentError;
  strategy: RecoveryStrategy;
  attemptsUsed: number;
}

export type RecoveryStrategy =
  | 'retry_with_error_feedback'
  | 'shrink_scope'
  | 'fallback_model'
  | 'none';

/**
 * Main recovery engine - attempts multiple strategies to fix agent errors
 */
export class RecoveryEngine {
  /**
   * Attempt to recover from an agent error
   */
  async recover(context: RecoveryContext): Promise<RecoveryResult> {
    console.log(
      `[Recovery] Attempt ${context.attempt}/${context.maxAttempts} for error: ${context.error.type}`
    );

    // Check if we've exceeded max attempts
    if (context.attempt >= context.maxAttempts) {
      return {
        success: false,
        error: context.error,
        strategy: 'none',
        attemptsUsed: context.attempt,
      };
    }

    // Try recovery strategies in order
    const strategies: RecoveryStrategy[] = [
      'retry_with_error_feedback',
      'shrink_scope',
      'fallback_model',
    ];

    for (const strategy of strategies) {
      try {
        const result = await this.tryStrategy(strategy, context);
        if (result.success) {
          console.log(`[Recovery] Success with strategy: ${strategy}`);
          return result;
        }
      } catch (error: any) {
        console.warn(`[Recovery] Strategy ${strategy} failed:`, error);
      }
    }

    // All strategies failed
    return {
      success: false,
      error: context.error,
      strategy: 'none',
      attemptsUsed: context.attempt,
    };
  }

  /**
   * Try a specific recovery strategy
   */
  private async tryStrategy(
    strategy: RecoveryStrategy,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    switch (strategy) {
      case 'retry_with_error_feedback':
        return this.retryWithErrorFeedback(context);

      case 'shrink_scope':
        return this.shrinkScope(context);

      case 'fallback_model':
        return this.fallbackModel(context);

      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  /**
   * Strategy 1: Retry with error feedback
   * Ask the LLM to fix its own output based on the error
   */
  private async retryWithErrorFeedback(context: RecoveryContext): Promise<RecoveryResult> {
    const systemPrompt =
      context.locale === 'ar'
        ? `أنت مساعد ذكاء اصطناعي متخصص في إصلاح الأخطاء في تعديلات الكود.

**المشكلة:**
محاولتك السابقة لإنشاء patch فشلت بالخطأ التالي:

**نوع الخطأ:** ${context.error.type}
**الرسالة:** ${context.error.message}
**التفاصيل:** ${JSON.stringify(context.error.details, null, 2)}

**مهمتك:**
قم بتحليل الخطأ وإنشاء patch صحيح يحل المشكلة.

**إرشادات:**
- استخدم صيغة unified diff بشكل صحيح
- تأكد من تطابق السياق مع الكود الموجود
- استخدم عدد أسطر السياق المناسب (3 على الأقل)
- لا تضف تغييرات غير ضرورية
- ركز فقط على إصلاح المشكلة الأصلية

أرجع patch صحيح فقط داخل \`\`\`diff\`\`\``
        : `You are an AI assistant specialized in fixing code patch errors.

**Problem:**
Your previous attempt to create a patch failed with the following error:

**Error Type:** ${context.error.type}
**Message:** ${context.error.message}
**Details:** ${JSON.stringify(context.error.details, null, 2)}

**Your Task:**
Analyze the error and create a corrected patch that resolves the issue.

**Guidelines:**
- Use unified diff format correctly
- Ensure context lines match existing code exactly
- Use appropriate context lines (at least 3)
- Do not add unnecessary changes
- Focus only on fixing the original issue

Return ONLY the corrected patch inside \`\`\`diff\`\`\``;

    const userPrompt =
      context.locale === 'ar'
        ? `الطلب الأصلي: ${context.originalRequest}\n\nمحاولتك السابقة:\n${context.originalResponse}\n\nأصلح هذا الـ patch الآن.`
        : `Original request: ${context.originalRequest}\n\nYour previous attempt:\n${context.originalResponse}\n\nFix this patch now.`;

    try {
      const response = await this.callLLM(systemPrompt, userPrompt, 'gpt-4o');

      // Extract and parse the corrected patch
      const diffText = extractPatchFromMarkdown(response);
      if (!diffText) {
        throw new AgentError(
          AgentErrorType.INVALID_FORMAT,
          'No diff block found in corrected response'
        );
      }

      const patches = parsePatch(diffText);
      if (patches.length === 0) {
        throw new AgentError(AgentErrorType.PARSE_ERROR, 'Failed to parse corrected patch');
      }

      return {
        success: true,
        correctedResponse: response,
        patch: patches[0],
        strategy: 'retry_with_error_feedback',
        attemptsUsed: context.attempt + 1,
      };
    } catch (error: any) {
      return {
        success: false,
        error: toAgentError(error),
        strategy: 'retry_with_error_feedback',
        attemptsUsed: context.attempt + 1,
      };
    }
  }

  /**
   * Strategy 2: Shrink scope
   * Ask for smaller, more focused changes
   */
  private async shrinkScope(context: RecoveryContext): Promise<RecoveryResult> {
    // Only applicable for patch conflicts
    if (context.error.type !== AgentErrorType.PATCH_CONFLICT) {
      throw new Error('Shrink scope only applies to patch conflicts');
    }

    const systemPrompt =
      context.locale === 'ar'
        ? `أنت مساعد ذكاء اصطناعي متخصص في التعديلات الدقيقة على الكود.

**المشكلة:**
الـ patch السابق كان كبيراً جداً وتسبب في تعارض.

**مهمتك:**
قم بإنشاء patch أصغر وأكثر تركيزاً يعدل فقط **الحد الأدنى** من الأسطر المطلوبة.

**إرشادات:**
- عدّل سطر واحد أو سطرين فقط في كل مرة
- استخدم سياق دقيق جداً (5-7 أسطر)
- لا تعدل أجزاء غير متعلقة بالمشكلة
- تأكد من تطابق السياق 100%

أرجع patch مصغّر داخل \`\`\`diff\`\`\``
        : `You are an AI assistant specialized in surgical code edits.

**Problem:**
The previous patch was too large and caused a conflict.

**Your Task:**
Create a smaller, more focused patch that modifies ONLY the **minimum** required lines.

**Guidelines:**
- Modify only 1-2 lines at a time
- Use very precise context (5-7 lines)
- Do not touch unrelated code
- Ensure context matches 100%

Return a minimal patch inside \`\`\`diff\`\`\``;

    const userPrompt = `Original request: ${context.originalRequest}`;

    try {
      const response = await this.callLLM(systemPrompt, userPrompt, 'gpt-4o');

      const diffText = extractPatchFromMarkdown(response);
      if (!diffText) {
        throw new AgentError(
          AgentErrorType.INVALID_FORMAT,
          'No diff block found in shrunk patch'
        );
      }

      const patches = parsePatch(diffText);
      if (patches.length === 0) {
        throw new AgentError(AgentErrorType.PARSE_ERROR, 'Failed to parse shrunk patch');
      }

      return {
        success: true,
        correctedResponse: response,
        patch: patches[0],
        strategy: 'shrink_scope',
        attemptsUsed: context.attempt + 1,
      };
    } catch (error: any) {
      return {
        success: false,
        error: toAgentError(error),
        strategy: 'shrink_scope',
        attemptsUsed: context.attempt + 1,
      };
    }
  }

  /**
   * Strategy 3: Fallback model
   * Try with a different model (e.g., gpt-4o-mini)
   */
  private async fallbackModel(context: RecoveryContext): Promise<RecoveryResult> {
    const systemPrompt =
      context.locale === 'ar'
        ? `أنت مساعد ذكاء اصطناعي. قم بإنشاء patch لتعديل الكود بناءً على الطلب التالي.

استخدم صيغة unified diff واحرص على:
- تطابق السياق بدقة
- استخدام 3 أسطر سياق على الأقل
- تعديلات دقيقة فقط

أرجع الـ patch داخل \`\`\`diff\`\`\``
        : `You are an AI assistant. Create a patch to modify code based on the following request.

Use unified diff format and ensure:
- Context matches precisely
- At least 3 context lines
- Surgical edits only

Return the patch inside \`\`\`diff\`\`\``;

    const userPrompt = `Request: ${context.originalRequest}`;

    try {
      const response = await this.callLLM(systemPrompt, userPrompt, 'gpt-4o-mini');

      const diffText = extractPatchFromMarkdown(response);
      if (!diffText) {
        throw new AgentError(
          AgentErrorType.INVALID_FORMAT,
          'No diff block found in fallback response'
        );
      }

      const patches = parsePatch(diffText);
      if (patches.length === 0) {
        throw new AgentError(AgentErrorType.PARSE_ERROR, 'Failed to parse fallback patch');
      }

      return {
        success: true,
        correctedResponse: response,
        patch: patches[0],
        strategy: 'fallback_model',
        attemptsUsed: context.attempt + 1,
      };
    } catch (error: any) {
      return {
        success: false,
        error: toAgentError(error),
        strategy: 'fallback_model',
        attemptsUsed: context.attempt + 1,
      };
    }
  }

  /**
   * Call OpenAI LLM
   */
  private async callLLM(
    systemPrompt: string,
    userPrompt: string,
    model: string = 'gpt-4o'
  ): Promise<string> {
    const body = {
      model: model === 'gpt-4o' ? process.env.OPENAI_MODEL || 'gpt-4o' : model,
      temperature: 0.1,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => '');
      throw new AgentError(
        AgentErrorType.ROUTING_ERROR,
        `LLM request failed (${res.status}): ${errTxt}`
      );
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';

    if (!content) {
      throw new AgentError(AgentErrorType.EMPTY_RESPONSE, 'Empty response from LLM');
    }

    return content;
  }
}

/**
 * Global recovery engine instance
 */
export const recoveryEngine = new RecoveryEngine();
