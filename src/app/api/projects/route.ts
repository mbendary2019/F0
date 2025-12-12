/**
 * Phase 79: Unified Project Management
 * POST /api/projects — Create new project
 * GET /api/projects — List user's projects
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { requireUser } from '@/lib/api/requireUser';
import type { F0Project, CreateProjectRequest, ListProjectsResponse } from '@/types/project';

const db = getFirestore(adminApp);

/**
 * POST /api/projects
 * Create a new project with ownerUid
 */
export async function POST(req: NextRequest) {
  try {
    // Phase 84.7: Verify authentication
    const user = await requireUser(req);

    // Parse request body
    const body: CreateProjectRequest = await req.json();
    const nameRaw = (body.name || '').toString().trim();
    const shortDescription = (body.shortDescription || '').toString().trim();
    const techStack = (body.techStack || '').toString().trim();

    if (!nameRaw) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Create new project document
    const now = Timestamp.now();
    const docRef = db.collection('projects').doc();
    const projectId = docRef.id;

    const data = {
      ownerUid: user.uid,
      name: nameRaw,
      shortDescription: shortDescription || null,
      techStack: techStack || null,
      createdAt: now,
      updatedAt: now,
      status: 'active' as const,
    };

    await docRef.set(data);

    // Return created project
    const project: F0Project = {
      id: projectId,
      ownerUid: user.uid,
      name: nameRaw,
      shortDescription: shortDescription || undefined,
      techStack: techStack || undefined,
      createdAt: now.toDate().toISOString(),
      updatedAt: now.toDate().toISOString(),
      status: 'active',
    };

    console.log(`[API Projects] Created project ${projectId} for user ${user.uid}`);

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    console.error('[API Projects] Create project failed:', error);

    // Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects
 * List all projects owned by authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    // Phase 84.7: Verify authentication
    const user = await requireUser(req);

    // Query projects owned by this user
    const snapshot = await db
      .collection('projects')
      .where('ownerUid', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .get();

    // Transform Firestore documents to F0Project
    const projects: F0Project[] = snapshot.docs.map((doc) => {
      const d = doc.data() as any;

      const createdAt =
        d.createdAt && d.createdAt.toDate
          ? d.createdAt.toDate().toISOString()
          : new Date().toISOString();

      const updatedAt =
        d.updatedAt && d.updatedAt.toDate
          ? d.updatedAt.toDate().toISOString()
          : createdAt;

      return {
        id: doc.id,
        ownerUid: d.ownerUid,
        name: d.name || 'Untitled Project',
        shortDescription: d.shortDescription || undefined,
        techStack: d.techStack || undefined,
        createdAt,
        updatedAt,
        status: (d.status as any) || 'active',
      };
    });

    const response: ListProjectsResponse = { projects };

    console.log(`[API Projects] Listed ${projects.length} projects for user ${user.uid}`);

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('[API Projects] List projects failed:', error);

    // Handle authentication errors
    if (error.message === 'NO_TOKEN' || error.message === 'INVALID_TOKEN') {
      return NextResponse.json(
        { error: 'Unauthorized', details: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
