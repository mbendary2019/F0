/**
 * Phase 78: Developer Mode Assembly - Create Project from Template
 * POST /api/projects/from-template - Create a new project from a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/api/requireUser';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import type { TemplateFile, F0Template, CreateProjectFromTemplateRequest, CreateProjectFromTemplateResponse } from '@/types/templates';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify authentication
    const user = await requireUser(req);

    // 2. Parse request body
    const body: CreateProjectFromTemplateRequest = await req.json();
    const { templateId, name, createGitHubRepo, githubRepoName } = body;

    if (!templateId || !name || !name.trim()) {
      return NextResponse.json(
        { error: 'templateId and name are required' },
        { status: 400 }
      );
    }

    const db = getFirestore(adminApp);

    // 3. Check entitlements (max projects)
    // TODO: Implement project count check against user's plan limits
    // const currentProjectCount = await db.collection('projects').where('ownerUid', '==', user.uid).count().get();
    // if (currentProjectCount.data().count >= maxProjects) {
    //   return NextResponse.json({ error: 'Project limit reached' }, { status: 403 });
    // }

    // 4. Load template
    const tmplDoc = await db.collection('templates').doc(templateId).get();

    if (!tmplDoc.exists) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const tmplData = tmplDoc.data() as F0Template;

    // 5. Verify template visibility (basic check)
    if (tmplData.visibility !== 'public') {
      // TODO: Check if user has access to private/unlisted templates
      return NextResponse.json(
        { error: 'Template not accessible' },
        { status: 403 }
      );
    }

    // 6. Create project document
    const now = Timestamp.now();
    const projectRef = db.collection('projects').doc();
    const projectId = projectRef.id;

    const projectData = {
      ownerUid: user.uid,
      name: name.trim(),
      shortDescription: tmplData.description?.slice(0, 140) || '',
      techStack: tmplData.techStack || [],
      createdAt: now,
      updatedAt: now,
      status: 'active',
      templateId: tmplDoc.id,
      templateSlug: tmplData.slug,
      category: tmplData.category,
    };

    // 7. Load template files
    console.log(`[Create Project] Loading files for template ${templateId}`);

    const filesSnap = await db
      .collection('templates')
      .doc(templateId)
      .collection('files')
      .get();

    console.log(`[Create Project] Found ${filesSnap.docs.length} template files`);

    // 8. Create project and copy files in batch
    const batch = db.batch();

    // Create project document
    batch.set(projectRef, projectData);

    // Copy all template files to project
    filesSnap.docs.forEach((fileDoc) => {
      const f = fileDoc.data() as TemplateFile;
      const destRef = projectRef.collection('files').doc();
      batch.set(destRef, {
        path: f.path,
        content: f.content,
        isBinary: f.isBinary ?? false,
        createdAt: now,
        updatedAt: now,
      });
    });

    await batch.commit();

    console.log(
      `[Create Project] Successfully created project ${projectId} from template ${tmplData.slug}`
    );

    // 9. Prepare response
    const response: CreateProjectFromTemplateResponse = {
      id: projectId,
      name: name.trim(),
      templateId: tmplDoc.id,
      templateSlug: tmplData.slug,
      fileCount: filesSnap.docs.length,
    };

    // 10. Optional: Create GitHub repo (if requested)
    if (createGitHubRepo && githubRepoName) {
      // TODO: Call GitHub integration to create repo
      // const githubRes = await fetch(`${req.url.split('/api')[0]}/api/integrations/github/create-repo`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ projectId, repoName: githubRepoName }),
      // });
      // if (githubRes.ok) {
      //   const githubData = await githubRes.json();
      //   response.githubRepoUrl = githubData.repoUrl;
      // }
      console.log('[Create Project] GitHub repo creation requested but not yet implemented');
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error('[Create Project] Error creating project from template:', error);

    // Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create project', details: error.message },
      { status: 500 }
    );
  }
}
