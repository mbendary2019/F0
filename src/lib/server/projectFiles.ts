/**
 * Phase 74: Auto GitHub Push - Project Files Helper
 * Retrieves project file snapshots for pushing to GitHub
 */

import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import type { ProjectFileSnapshot } from '@/types/files';

/**
 * getProjectFilesSnapshot
 * Returns a list of files that should be pushed to GitHub.
 *
 * Current implementation: Reads from Firestore collection projects/{projectId}/files/{fileId}
 * Can be modified later to read from Cloud Storage or other sources without breaking the API.
 *
 * @param projectId - The project ID to get files for
 * @returns Array of file snapshots with path and content
 */
export async function getProjectFilesSnapshot(
  projectId: string
): Promise<ProjectFileSnapshot[]> {
  const db = getFirestore(adminApp);

  try {
    // Read files from Firestore subcollection
    const filesSnap = await db
      .collection('projects')
      .doc(projectId)
      .collection('files')
      .get();

    if (filesSnap.empty) {
      console.warn(
        `[ProjectFiles] No files found for project ${projectId}`
      );
      return [];
    }

    const files: ProjectFileSnapshot[] = filesSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        path: data.path || doc.id, // Fallback to doc ID if path not set
        content: data.content || '',
        isBinary: data.isBinary ?? false,
      };
    });

    console.log(
      `[ProjectFiles] Retrieved ${files.length} files for project ${projectId}`
    );

    return files;
  } catch (error: any) {
    console.error(
      `[ProjectFiles] Error retrieving files for project ${projectId}:`,
      error
    );
    throw new Error(`Failed to retrieve project files: ${error.message}`);
  }
}

/**
 * Alternative: Get project files from a specific template/scaffold
 * This can be used if projects are generated from templates rather than user-edited files
 *
 * @param projectId - The project ID
 * @param templateId - Optional template ID to use
 * @returns Array of file snapshots
 */
export async function getProjectFilesFromTemplate(
  projectId: string,
  templateId?: string
): Promise<ProjectFileSnapshot[]> {
  // TODO: Implement template-based file generation
  // For now, fallback to regular snapshot
  return getProjectFilesSnapshot(projectId);
}
