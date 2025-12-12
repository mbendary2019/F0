/**
 * Phase 110.3: Desktop IDE Run Tests Endpoint
 * POST /api/ide/desktop-run-tests
 *
 * Runs QA checks (static analysis / AI review) for a project
 * Called from Desktop IDE "Run QA" button
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { runCombinedQa } from '@/lib/server/qa';
import type { QaMode } from '@/lib/server/actions';
import { logAiOperation } from '@/lib/server/aiLogs';

const db = adminDb;

// API Key for Desktop authentication
const DESKTOP_API_KEY = process.env.F0_DESKTOP_API_KEY;

// Dev bypass helper
function isDevEnv() {
  return process.env.NODE_ENV === 'development' ||
         process.env.NEXT_PUBLIC_F0_ENV === 'emulator' ||
         process.env.NEXT_PUBLIC_USE_EMULATORS === '1';
}

// CORS headers for Desktop IDE
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface DesktopRunTestsRequest {
  projectId: string;
  qaMode?: QaMode; // 'static' | 'ai' | 'both'
  locale?: 'ar' | 'en';
  taskId?: string; // Optional: specific task to run QA on
  filesChanged?: string[]; // Optional: list of files to check
}

interface DesktopRunTestsResponse {
  ok: boolean;
  result?: {
    passed: boolean;
    summary: string;
    details?: string;
    score?: number;
    staticResult?: {
      passed: boolean;
      tscErrors?: number;
      lintErrors?: number;
    };
    aiResult?: {
      passed: boolean;
      issues?: Array<{
        file: string;
        line?: number;
        severity: 'error' | 'warning' | 'info';
        message: string;
      }>;
    };
  };
  errorCode?: string;
  message?: string;
}

function jsonResponse(data: DesktopRunTestsResponse, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

/** Handle CORS preflight requests */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  let body: DesktopRunTestsRequest;

  // Parse request body
  try {
    body = await req.json();
  } catch {
    return jsonResponse({
      ok: false,
      errorCode: 'BAD_REQUEST',
      message: 'Invalid JSON body',
    }, 400);
  }

  const { projectId, qaMode = 'static', locale = 'ar', taskId, filesChanged } = body;

  // Validate required fields
  if (!projectId) {
    return jsonResponse({
      ok: false,
      errorCode: 'BAD_REQUEST',
      message: 'Missing projectId',
    }, 400);
  }

  try {
    // 1. Authenticate (with dev bypass)
    let uid = 'dev-user';

    if (isDevEnv()) {
      console.log('[Desktop Run Tests] Dev bypass enabled');
    } else {
      // Production: require API key or Firebase token
      const authHeader = req.headers.get('authorization') || '';
      const [, token] = authHeader.split(' ');

      if (!token) {
        return jsonResponse({
          ok: false,
          errorCode: 'AUTH_REQUIRED',
          message: 'Missing Authorization header',
        }, 401);
      }

      // Check API key
      if (DESKTOP_API_KEY && token === DESKTOP_API_KEY) {
        uid = 'desktop-api-key-user';
        console.log('[Desktop Run Tests] Authenticated via API key');
      } else {
        // Try Firebase token
        try {
          const decodedToken = await adminAuth.verifyIdToken(token);
          uid = decodedToken.uid;
          console.log('[Desktop Run Tests] Authenticated via Firebase token');
        } catch {
          return jsonResponse({
            ok: false,
            errorCode: 'INVALID_API_KEY',
            message: 'Invalid API key or Firebase token',
          }, 401);
        }
      }
    }

    console.log('[Desktop Run Tests] Request:', {
      projectId,
      qaMode,
      locale,
      taskId,
      filesChangedCount: filesChanged?.length || 0,
    });

    // 2. Get project info
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
      console.warn('[Desktop Run Tests] Project not found:', projectId);
      // Continue anyway - QA can still run
    }

    // 3. Run QA
    const startTime = Date.now();

    const qaResult = await runCombinedQa({
      projectId,
      taskId,
      filesChanged: filesChanged || [],
      qaMode,
      locale,
      runTsc: true,
      runLint: true,
      runTests: false, // Don't run unit tests from Desktop for now
    });

    const duration = Date.now() - startTime;
    console.log('[Desktop Run Tests] QA completed:', {
      passed: qaResult.ok,
      score: qaResult.overallScore,
      duration: `${duration}ms`,
    });

    // 4. Log to AI activity
    await logAiOperation({
      origin: 'desktop-ide',
      projectId,
      mode: 'task', // QA is a task mode
      success: qaResult.ok,
      summary: `QA ${qaMode}: ${qaResult.ok ? 'Passed' : 'Failed'} (score: ${qaResult.overallScore || 'N/A'})`,
      uid,
      metadata: {
        qaMode,
        score: qaResult.overallScore,
        staticPassed: qaResult.staticResult?.ok,
        aiPassed: qaResult.aiResult?.ok,
        duration,
      },
    });

    // 5. Build response
    const response: DesktopRunTestsResponse = {
      ok: true,
      result: {
        passed: qaResult.ok,
        summary: qaResult.summary,
        details: qaResult.details,
        score: qaResult.overallScore,
        staticResult: qaResult.static ? {
          passed: qaResult.static.ok,
          tscErrors: qaResult.static.checks?.tsc?.errorCount,
          lintErrors: qaResult.static.checks?.lint?.errorCount,
        } : undefined,
        aiResult: qaResult.ai ? {
          passed: qaResult.ai.ok,
          issues: qaResult.ai.issues?.map(issue => ({
            file: issue.file,
            line: issue.line,
            severity: issue.severity,
            message: issue.message,
          })),
        } : undefined,
      },
    };

    return jsonResponse(response);

  } catch (error: any) {
    console.error('[Desktop Run Tests] Error:', error);

    // Log error
    await logAiOperation({
      origin: 'desktop-ide',
      projectId,
      mode: 'task',
      success: false,
      errorMessage: error?.message || 'Unknown error',
    });

    return jsonResponse({
      ok: false,
      errorCode: 'QA_ERROR',
      message: error?.message || 'Unexpected error while running QA',
    }, 500);
  }
}
