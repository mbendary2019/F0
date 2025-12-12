// src/app/api/ui/generate/execute/route.ts
// =============================================================================
// Phase 167.5 – UI Generation Execute API
// POST: Execute full UI generation pipeline
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebaseAdmin } from '@/lib/server/firebase';

// Initialize Firebase
initFirebaseAdmin();
const db = getFirestore();

// =============================================================================
// Types
// =============================================================================

type UiGenerationMode = 'create_page' | 'extend_page' | 'inject_section' | 'replace_section' | 'create_component';
type UiFileKind = 'page' | 'layout' | 'component' | 'hook' | 'style' | 'util' | 'type' | 'api';

interface UiFileTarget {
  path: string;
  kind: UiFileKind;
  language?: string;
}

interface UiComponentPlan {
  id: string;
  type: string;
  name: string;
  props: Record<string, unknown>;
  children?: UiComponentPlan[];
  positionHint?: string;
}

interface UiFilePlan {
  id: string;
  target: UiFileTarget;
  action: 'create' | 'modify';
  description: string;
  components: UiComponentPlan[];
}

interface UiGenerationPlan {
  id: string;
  projectId: string;
  proposalId: string;
  mode: UiGenerationMode;
  routePath: string;
  pageName: string;
  files: UiFilePlan[];
  status: string;
  createdAt: number;
  updatedAt: number;
}

interface UiFileChange {
  id: string;
  target: UiFileTarget;
  action: 'create' | 'modify' | 'delete';
  language: string;
  newContent?: string;
  summary: string;
  linesAdded?: number;
}

interface UiCodegenResult {
  planId: string;
  projectId: string;
  files: UiFileChange[];
  totalFiles: number;
  filesCreated: number;
  filesModified: number;
  generationTimeMs: number;
}

interface UiApplyResult {
  planId: string;
  projectId: string;
  success: boolean;
  appliedFiles: UiFileTarget[];
  failedFiles?: Array<{ target: UiFileTarget; error: string }>;
  rollbackAvailable: boolean;
  rollbackId?: string;
  summary: string;
  applyTimeMs: number;
}

interface ExecuteRequest {
  projectId: string;
  proposalId: string;
  attachmentId?: string;
  modeOverride?: UiGenerationMode;
  dryRun?: boolean;
}

// =============================================================================
// Collections
// =============================================================================

const PROPOSALS_COLLECTION = 'uiGenerationProposals';
const PLANS_COLLECTION = 'uiGenerationPlans';
const VFS_COLLECTION = 'projectFiles';
const ROLLBACK_COLLECTION = 'uiRollbacks';

// =============================================================================
// Helpers
// =============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// Protected paths that shouldn't be modified
const PROTECTED_PATHS = ['.env', 'firebase.json', 'firestore.rules', 'package.json'];

function isProtectedPath(path: string): boolean {
  return PROTECTED_PATHS.some(p => path.toLowerCase().includes(p.toLowerCase()));
}

// =============================================================================
// Code Generation Templates
// =============================================================================

function generatePageCode(plan: UiGenerationPlan): string {
  const components = plan.files[0]?.components || [];

  let componentsJsx = components.map(comp => {
    const type = comp.type.toLowerCase();

    if (type.includes('stat') || type.includes('card')) {
      return `        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">1,234</p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="text-2xl font-bold">$12,345</p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">Orders</p>
            <p className="text-2xl font-bold">456</p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">Growth</p>
            <p className="text-2xl font-bold text-green-500">+12%</p>
          </div>
        </div>`;
    }

    if (type.includes('table') || type.includes('data')) {
      return `        {/* Data Table */}
        <div className="rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-4 py-3 text-sm">Sample Item</td>
                <td className="px-4 py-3 text-sm">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Active</span>
                </td>
                <td className="px-4 py-3 text-sm">Dec 9, 2024</td>
                <td className="px-4 py-3 text-sm">
                  <button className="text-blue-500 hover:underline">Edit</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>`;
    }

    if (type.includes('chart') || type.includes('graph')) {
      return `        {/* Chart */}
        <div className="rounded-lg border p-6 h-64 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="text-4xl mb-2">📊</div>
            <p>Chart Placeholder</p>
          </div>
        </div>`;
    }

    if (type.includes('form')) {
      return `        {/* Form */}
        <form className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input type="text" className="w-full px-3 py-2 rounded-md border" placeholder="Enter name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" className="w-full px-3 py-2 rounded-md border" placeholder="Enter email" />
          </div>
          <button type="submit" className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md">
            Submit
          </button>
        </form>`;
    }

    // Default component
    return `        {/* ${comp.name} */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">${comp.name}</h3>
          <p className="text-muted-foreground">Content for ${comp.name}</p>
        </div>`;
  }).join('\n\n');

  if (!componentsJsx) {
    componentsJsx = `        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Welcome</h3>
          <p className="text-muted-foreground">This page was generated by F0 UI Builder</p>
        </div>`;
  }

  return `'use client';

// =============================================================================
// ${plan.pageName}
// Generated by F0 UI Builder
// =============================================================================

export default function ${plan.pageName}() {
  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">${plan.pageName.replace('Page', '')}</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 space-y-8">
${componentsJsx}
      </main>
    </div>
  );
}
`;
}

// =============================================================================
// POST: Execute UI Generation
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[167.5][API] POST /api/ui/generate/execute');

  try {
    const body = await request.json() as ExecuteRequest;
    const { projectId, proposalId, attachmentId, modeOverride, dryRun = false } = body;

    // Validation
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!proposalId) {
      return NextResponse.json({ error: 'proposalId is required' }, { status: 400 });
    }

    // ===========================================
    // Stage 1: Load Proposal
    // ===========================================
    console.log('[167.5][API] Stage 1: Loading proposal');

    const proposalDoc = await db.collection(PROPOSALS_COLLECTION).doc(proposalId).get();
    if (!proposalDoc.exists) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const proposal = proposalDoc.data()!;
    if (proposal.projectId !== projectId) {
      return NextResponse.json({ error: 'Project ID mismatch' }, { status: 400 });
    }

    // ===========================================
    // Stage 2: Build Generation Plan
    // ===========================================
    console.log('[167.5][API] Stage 2: Building plan');

    const routePath = proposal.suggestedRoute || '/new-page';
    const pageName = routePath
      .split('/')
      .filter(Boolean)
      .pop()
      ?.split('-')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('') + 'Page' || 'NewPage';

    // Convert proposal component tree to file plans
    const componentTree = proposal.componentTree || { type: 'Container', name: 'Main' };
    const components: UiComponentPlan[] = [];

    function extractComponents(node: { type?: string; name?: string; children?: unknown[]; props?: Record<string, unknown> }, depth = 0) {
      if (node.type) {
        components.push({
          id: generateId('comp'),
          type: node.type,
          name: node.name || node.type,
          props: node.props || {},
          positionHint: depth === 0 ? 'main' : 'inline',
        });
      }
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          extractComponents(child as { type?: string; name?: string; children?: unknown[]; props?: Record<string, unknown> }, depth + 1);
        }
      }
    }
    extractComponents(componentTree);

    const plan: UiGenerationPlan = {
      id: generateId('plan'),
      projectId,
      proposalId,
      mode: modeOverride || 'create_page',
      routePath,
      pageName,
      files: [{
        id: generateId('file'),
        target: {
          path: `src/app${routePath}/page.tsx`,
          kind: 'page',
          language: 'tsx',
        },
        action: 'create',
        description: `Main page for ${routePath}`,
        components,
      }],
      status: 'PLANNED',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save plan
    await db.collection(PLANS_COLLECTION).doc(plan.id).set(plan);

    // ===========================================
    // Stage 3: Generate Code
    // ===========================================
    console.log('[167.5][API] Stage 3: Generating code');

    await db.collection(PLANS_COLLECTION).doc(plan.id).update({ status: 'RUNNING' });

    const pageCode = generatePageCode(plan);

    const fileChanges: UiFileChange[] = [{
      id: generateId('change'),
      target: plan.files[0].target,
      action: 'create',
      language: 'tsx',
      newContent: pageCode,
      summary: `Created ${pageName} at ${plan.files[0].target.path}`,
      linesAdded: pageCode.split('\n').length,
    }];

    const codegen: UiCodegenResult = {
      planId: plan.id,
      projectId,
      files: fileChanges,
      totalFiles: 1,
      filesCreated: 1,
      filesModified: 0,
      generationTimeMs: Date.now() - startTime,
    };

    // ===========================================
    // Stage 4: Apply Changes
    // ===========================================
    console.log('[167.5][API] Stage 4: Applying changes');

    const appliedFiles: UiFileTarget[] = [];
    const failedFiles: Array<{ target: UiFileTarget; error: string }> = [];
    const originalFiles: Array<{ path: string; content: string | null }> = [];

    for (const change of fileChanges) {
      const filePath = change.target.path;

      // Safety check
      if (isProtectedPath(filePath)) {
        failedFiles.push({ target: change.target, error: 'Protected path' });
        continue;
      }

      // Get original content for rollback
      const docId = `${projectId}_${filePath.replace(/\//g, '_')}`;
      const existingDoc = await db.collection(VFS_COLLECTION).doc(docId).get();
      originalFiles.push({
        path: filePath,
        content: existingDoc.exists ? existingDoc.data()?.content : null,
      });

      // Apply if not dry run
      if (!dryRun) {
        try {
          await db.collection(VFS_COLLECTION).doc(docId).set({
            projectId,
            path: filePath,
            content: change.newContent,
            language: 'tsx',
            size: change.newContent?.length || 0,
            lastModified: Date.now(),
            createdAt: Date.now(),
            source: 'ui-builder',
          }, { merge: true });

          appliedFiles.push(change.target);
        } catch (err) {
          failedFiles.push({
            target: change.target,
            error: err instanceof Error ? err.message : 'Write failed',
          });
        }
      } else {
        appliedFiles.push(change.target);
      }
    }

    // Create rollback record
    let rollbackId: string | undefined;
    if (!dryRun && originalFiles.length > 0) {
      rollbackId = generateId('rollback');
      await db.collection(ROLLBACK_COLLECTION).doc(rollbackId).set({
        id: rollbackId,
        planId: plan.id,
        projectId,
        originalFiles,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
    }

    const applyResult: UiApplyResult = {
      planId: plan.id,
      projectId,
      success: failedFiles.length === 0,
      appliedFiles,
      failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
      rollbackAvailable: !!rollbackId,
      rollbackId,
      summary: dryRun
        ? `DRY RUN: Would create ${appliedFiles.length} file(s)`
        : `Applied ${appliedFiles.length} file(s)`,
      applyTimeMs: Date.now() - startTime,
    };

    // ===========================================
    // Stage 5: Finalize
    // ===========================================
    console.log('[167.5][API] Stage 5: Finalizing');

    await db.collection(PLANS_COLLECTION).doc(plan.id).update({
      status: dryRun ? 'PLANNED' : (failedFiles.length === 0 ? 'APPLIED' : 'FAILED'),
      executedAt: Date.now(),
      completedAt: Date.now(),
    });

    if (!dryRun && failedFiles.length === 0) {
      await db.collection(PROPOSALS_COLLECTION).doc(proposalId).update({
        status: 'COMPLETED',
        updatedAt: Date.now(),
      });
    }

    const totalTime = Date.now() - startTime;
    console.log('[167.5][API] Execute complete in', totalTime, 'ms');

    return NextResponse.json({
      success: failedFiles.length === 0,
      plan,
      codegen,
      applySummary: applyResult,
      stage: 'COMPLETE',
      totalTimeMs: totalTime,
    });

  } catch (error) {
    console.error('[167.5][API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stage: 'FAILED',
      },
      { status: 500 },
    );
  }
}

// ===========================================
// GET: Get execution status / list plans
// ===========================================

export async function GET(request: NextRequest) {
  console.log('[167.5][API] GET /api/ui/generate/execute');

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const planId = searchParams.get('planId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Get specific plan
    if (planId) {
      const doc = await db.collection(PLANS_COLLECTION).doc(planId).get();
      if (!doc.exists) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, plan: doc.data() });
    }

    // List plans for project
    const snap = await db
      .collection(PLANS_COLLECTION)
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const plans = snap.docs.map(doc => doc.data());

    return NextResponse.json({
      success: true,
      plans,
      total: plans.length,
    });

  } catch (error) {
    console.error('[167.5][API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
