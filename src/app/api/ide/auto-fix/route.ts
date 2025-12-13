// src/app/api/ide/auto-fix/route.ts
// Phase 144.2 – Backend Auto-Fix HTTP Endpoint with LLM Integration

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// ============================================
// Types
// ============================================

export interface AutoFixHttpRequest {
  projectId: string;
  filePath: string;
  source: string;
  issueIds: string[];
  issues?: Array<{
    id: string;
    message: string;
    line?: number;
    severity?: string;
    category?: string;
  }>;
}

export interface AutoFixHttpResponse {
  ok: boolean;
  fixedSource?: string;
  notes?: string;
  appliedIssueIds?: string[];
  skippedIssueIds?: string[];
}

// ============================================
// LLM Client (Lazy initialization to avoid build-time errors)
// ============================================

let _openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[AutoFix] OPENAI_API_KEY is not configured');
  }
  _openai = new OpenAI({ apiKey });
  return _openai;
}

// ============================================
// Auto-Fix Logic
// ============================================

async function runAutoFixLLM(input: AutoFixHttpRequest): Promise<AutoFixHttpResponse> {
  const { filePath, source, issueIds, issues } = input;

  // Build issue descriptions for the prompt
  const issueDescriptions = issues?.length
    ? issues.map((i) => `- Line ${i.line ?? '?'}: ${i.message} (${i.category ?? 'general'})`).join('\n')
    : issueIds.map((id) => `- Issue ID: ${id}`).join('\n');

  const prompt = `You are an expert TypeScript/JavaScript engineer working inside the From Zero IDE.

File path: ${filePath}

Issues to fix:
${issueDescriptions}

Your task:
1. Fix the identified issues in the code below
2. Keep the structure as close as possible to the original
3. Do NOT add comments explaining changes
4. Do NOT add new features or refactor unrelated code
5. Return ONLY the full updated file content
6. Do NOT wrap the output in markdown code blocks

Original file:
------
${source}
------

Return the fixed file content (no markdown, no backticks, just the code):`;

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a code fixer. Return only the fixed code without any markdown formatting or explanations.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0,
      max_tokens: Math.min(source.length * 2, 8000),
    });

    let fixedSource = completion.choices[0]?.message?.content?.trim() ?? '';

    // Remove any markdown code blocks if present
    if (fixedSource.startsWith('```')) {
      // Remove opening ```typescript or ```javascript or just ```
      fixedSource = fixedSource.replace(/^```(?:typescript|javascript|tsx|jsx|ts|js)?\n?/, '');
      // Remove closing ```
      fixedSource = fixedSource.replace(/\n?```$/, '');
    }

    if (!fixedSource) {
      return { ok: false, notes: 'Empty LLM response' };
    }

    // Sanity check: if the fixed source is too different, flag it
    const lengthRatio = fixedSource.length / source.length;
    if (lengthRatio < 0.5 || lengthRatio > 2.0) {
      console.warn('[AutoFix] Suspicious length ratio:', lengthRatio);
      // Still return but with a note
      return {
        ok: true,
        fixedSource,
        notes: `Warning: significant length change (${Math.round(lengthRatio * 100)}%)`,
        appliedIssueIds: issueIds,
        skippedIssueIds: [],
      };
    }

    return {
      ok: true,
      fixedSource,
      appliedIssueIds: issueIds,
      skippedIssueIds: [],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown LLM error';
    console.error('[AutoFix] LLM error:', message);
    return {
      ok: false,
      notes: `LLM error: ${message}`,
      appliedIssueIds: [],
      skippedIssueIds: issueIds,
    };
  }
}

// ============================================
// HTTP Handler
// ============================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as AutoFixHttpRequest;

    // Validate required fields
    if (!body?.filePath || !body?.source) {
      return NextResponse.json(
        { ok: false, notes: 'Missing filePath or source' },
        { status: 400 }
      );
    }

    if (!body.issueIds?.length && !body.issues?.length) {
      return NextResponse.json(
        { ok: false, notes: 'No issues to fix' },
        { status: 400 }
      );
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, notes: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Run the LLM-based auto-fix
    const result = await runAutoFixLLM(body);

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('[AutoFix HTTP] Error:', message);
    return NextResponse.json(
      { ok: false, notes: message },
      { status: 500 }
    );
  }
}
