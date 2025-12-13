/**
 * Phase 94.3: Project Memory API
 * GET /api/projects/[projectId]/memory - Get project memory
 * PATCH /api/projects/[projectId]/memory - Update memory section
 *
 * Provides access to structured project memory sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import {

export const dynamic = 'force-dynamic';
  getProjectMemory,
  updateMemorySection,
  appendToMemorySection,
  clearMemorySection,
  type MemorySectionKey,
  type ProjectMemory,
} from '@/lib/server/projectMemory';

// Dev bypass helper
function isDevEnv() {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_F0_ENV === 'emulator' ||
    process.env.NEXT_PUBLIC_USE_EMULATORS === '1'
  );
}

/**
 * GET /api/projects/[projectId]/memory
 * Returns the full project memory
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    // 1. Authenticate (with dev bypass)
    if (!isDevEnv()) {
      const authHeader = req.headers.get('authorization') || '';
      const [, token] = authHeader.split(' ');

      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      try {
        await adminAuth.verifyIdToken(token);
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    // 2. Get memory
    const memory = await getProjectMemory(projectId);

    // 3. Format for response (convert Timestamps to ISO strings)
    const formattedSections: Record<string, any> = {};

    for (const [key, section] of Object.entries(memory.sections)) {
      if (section) {
        formattedSections[key] = {
          text: section.text,
          updatedAt: section.updatedAt?.toDate?.()?.toISOString() || null,
          updatedBy: section.updatedBy || null,
        };
      }
    }

    console.log(`[Memory API] GET memory for project ${projectId}:`, Object.keys(formattedSections));

    return NextResponse.json({
      projectId,
      memory: {
        sections: formattedSections,
      },
    });
  } catch (error: any) {
    console.error('[Memory API] GET Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get memory' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[projectId]/memory
 * Update a specific memory section
 *
 * Body:
 * {
 *   section: "AGREED_SCOPE" | "TECH_STACK" | "ARCHITECTURE" | "RISKS" | "CONSTRAINTS" | "USER_PREFS",
 *   op: "replace" | "append" | "clear",
 *   text?: string
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    // 1. Authenticate (with dev bypass)
    let userId = 'dev-user';

    if (!isDevEnv()) {
      const authHeader = req.headers.get('authorization') || '';
      const [, token] = authHeader.split(' ');

      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      try {
        const decoded = await adminAuth.verifyIdToken(token);
        userId = decoded.uid;
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }

    // 2. Parse body
    const body = await req.json();
    const { section, op, text } = body;

    // Validate section
    const validSections: MemorySectionKey[] = [
      'AGREED_SCOPE',
      'TECH_STACK',
      'ARCHITECTURE',
      'RISKS',
      'CONSTRAINTS',
      'USER_PREFS',
    ];

    if (!section || !validSections.includes(section)) {
      return NextResponse.json(
        { error: `Invalid section. Must be one of: ${validSections.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate op
    if (!op || !['replace', 'append', 'clear'].includes(op)) {
      return NextResponse.json(
        { error: 'Invalid op. Must be one of: replace, append, clear' },
        { status: 400 }
      );
    }

    // 3. Execute operation
    if (op === 'clear') {
      await clearMemorySection({
        projectId,
        section,
      });
      console.log(`[Memory API] Cleared section ${section} for project ${projectId}`);
    } else if (op === 'replace') {
      if (!text) {
        return NextResponse.json(
          { error: 'text is required for replace operation' },
          { status: 400 }
        );
      }
      await updateMemorySection({
        projectId,
        section,
        text,
        updatedBy: userId,
      });
      console.log(`[Memory API] Replaced section ${section} for project ${projectId}`);
    } else if (op === 'append') {
      if (!text) {
        return NextResponse.json(
          { error: 'text is required for append operation' },
          { status: 400 }
        );
      }
      await appendToMemorySection({
        projectId,
        section,
        delta: text,
        updatedBy: userId,
      });
      console.log(`[Memory API] Appended to section ${section} for project ${projectId}`);
    }

    // 4. Return updated memory
    const memory = await getProjectMemory(projectId);

    const formattedSections: Record<string, any> = {};
    for (const [key, sectionData] of Object.entries(memory.sections)) {
      if (sectionData) {
        formattedSections[key] = {
          text: sectionData.text,
          updatedAt: sectionData.updatedAt?.toDate?.()?.toISOString() || null,
          updatedBy: sectionData.updatedBy || null,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      projectId,
      operation: op,
      section,
      memory: {
        sections: formattedSections,
      },
    });
  } catch (error: any) {
    console.error('[Memory API] PATCH Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update memory' },
      { status: 500 }
    );
  }
}
