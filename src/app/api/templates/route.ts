/**
 * Phase 78: Developer Mode Assembly - Templates API
 * GET /api/templates - List available project templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import type { F0Template } from '@/types/templates';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const db = getFirestore(adminApp);

    // Query public templates only
    const snapshot = await db
      .collection('templates')
      .where('visibility', '==', 'public')
      .orderBy('createdAt', 'desc')
      .get();

    const templates: F0Template[] = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        slug: d.slug || doc.id,
        name: d.name || 'Unnamed Template',
        description: d.description || '',
        category: d.category || 'internal',
        complexity: d.complexity || 'beginner',
        techStack: d.techStack || [],
        visibility: d.visibility || 'public',
        recommendedPlan: d.recommendedPlan || 'free',
        createdBy: d.createdBy || 'system',
        createdAt: d.createdAt?.toDate?.().toISOString?.() ?? new Date().toISOString(),
        updatedAt: d.updatedAt?.toDate?.().toISOString?.() ?? new Date().toISOString(),
        demoUrl: d.demoUrl,
        screenshotUrl: d.screenshotUrl,
        tags: d.tags || [],
      };
    });

    console.log(`[Templates API] Found ${templates.length} templates`);

    return NextResponse.json({ templates }, { status: 200 });
  } catch (error: any) {
    console.error('[Templates API] Error listing templates:', error);
    return NextResponse.json(
      { error: 'Failed to load templates', details: error.message },
      { status: 500 }
    );
  }
}
