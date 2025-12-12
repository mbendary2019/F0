/**
 * Phase 85.3: Project Analysis Storage
 * Save/load project dependency analysis from Firestore
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { IdeProjectAnalysisDocument } from '@/types/ideBridge';

/**
 * Save project analysis to Firestore
 * Path: projects/{projectId}/analysis/dependencyGraph
 */
export async function saveProjectAnalysis(
  projectId: string,
  analysis: IdeProjectAnalysisDocument
): Promise<void> {
  const docRef = doc(db, `projects/${projectId}/analysis/dependencyGraph`);
  await setDoc(docRef, {
    summary: analysis.summary,
    files: analysis.files,
    edges: analysis.edges,
    updatedAt: Date.now(),
  });
}

/**
 * Load project analysis from Firestore
 * Returns null if not found
 */
export async function loadProjectAnalysis(
  projectId: string
): Promise<IdeProjectAnalysisDocument | null> {
  const docRef = doc(db, `projects/${projectId}/analysis/dependencyGraph`);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    summary: data.summary,
    files: data.files,
    edges: data.edges,
  };
}
