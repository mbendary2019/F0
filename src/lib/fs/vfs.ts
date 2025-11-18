// src/lib/fs/vfs.ts
// Phase 82: Virtual File System - In-memory file storage before GitHub integration

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { applyPatch } from '@/lib/agents/patch/applyPatch';
import { Patch, PatchResult } from '@/lib/agents/patch/types';

export interface VFSFile {
  path: string;
  content: string;
  updatedAt: Timestamp | Date;
  updatedBy: string; // uid or 'agent'
  createdAt: Timestamp | Date;
  createdBy: string;
}

export interface VFSDirectory {
  path: string;
  files: string[];
  directories: string[];
}

/**
 * Read file from Virtual File System
 */
export async function readFile(projectId: string, filePath: string): Promise<string | null> {
  try {
    const fileDoc = await getDoc(doc(db, `projects/${projectId}/vfs/${encodeFilePath(filePath)}`));

    if (!fileDoc.exists()) {
      return null;
    }

    const data = fileDoc.data() as VFSFile;
    return data.content;
  } catch (error) {
    console.error(`[VFS] Error reading file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Write file to Virtual File System
 */
export async function writeFile(
  projectId: string,
  filePath: string,
  content: string,
  userId: string = 'agent'
): Promise<void> {
  try {
    const fileRef = doc(db, `projects/${projectId}/vfs/${encodeFilePath(filePath)}`);
    const existingDoc = await getDoc(fileRef);

    if (existingDoc.exists()) {
      // Update existing file
      await setDoc(fileRef, {
        content,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      }, { merge: true });
    } else {
      // Create new file
      await setDoc(fileRef, {
        path: filePath,
        content,
        createdAt: serverTimestamp(),
        createdBy: userId,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }

    console.log(`[VFS] File written: ${filePath}`);
  } catch (error) {
    console.error(`[VFS] Error writing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * List all files in Virtual File System
 */
export async function listFiles(projectId: string, directory?: string): Promise<VFSFile[]> {
  try {
    const vfsCollection = collection(db, `projects/${projectId}/vfs`);
    let q = query(vfsCollection);

    if (directory) {
      // Filter by directory prefix
      q = query(
        vfsCollection,
        where('path', '>=', directory),
        where('path', '<', directory + '\uf8ff')
      );
    }

    const snapshot = await getDocs(q);
    const files: VFSFile[] = [];

    snapshot.forEach((doc) => {
      files.push(doc.data() as VFSFile);
    });

    return files;
  } catch (error) {
    console.error('[VFS] Error listing files:', error);
    throw error;
  }
}

/**
 * Check if file exists in VFS
 */
export async function fileExists(projectId: string, filePath: string): Promise<boolean> {
  try {
    const fileDoc = await getDoc(doc(db, `projects/${projectId}/vfs/${encodeFilePath(filePath)}`));
    return fileDoc.exists();
  } catch (error) {
    console.error(`[VFS] Error checking file existence ${filePath}:`, error);
    return false;
  }
}

/**
 * Ensure file exists, create with empty content if not
 */
export async function ensureFileExists(
  projectId: string,
  filePath: string,
  userId: string = 'agent'
): Promise<void> {
  const exists = await fileExists(projectId, filePath);

  if (!exists) {
    await writeFile(projectId, filePath, '', userId);
  }
}

/**
 * Delete file from VFS
 */
export async function deleteFile(projectId: string, filePath: string): Promise<void> {
  try {
    const fileRef = doc(db, `projects/${projectId}/vfs/${encodeFilePath(filePath)}`);
    await setDoc(fileRef, {
      deleted: true,
      deletedAt: serverTimestamp(),
    }, { merge: true });

    console.log(`[VFS] File deleted: ${filePath}`);
  } catch (error) {
    console.error(`[VFS] Error deleting file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Apply a single patch to VFS
 */
export async function applyPatchToVFS(
  projectId: string,
  patch: Patch,
  userId: string = 'agent'
): Promise<PatchResult> {
  try {
    // Handle new file creation
    if (patch.isNew) {
      const newContent = patch.hunks
        .flatMap(hunk => hunk.lines)
        .filter(line => line.type === 'add' || line.type === 'context')
        .map(line => line.content)
        .join('\n');

      await writeFile(projectId, patch.filePath, newContent, userId);

      return {
        success: true,
        filePath: patch.filePath,
        modifiedContent: newContent,
      };
    }

    // Handle file deletion
    if (patch.isDeleted) {
      await deleteFile(projectId, patch.filePath);

      return {
        success: true,
        filePath: patch.filePath,
        modifiedContent: '',
      };
    }

    // Handle file modification
    const currentContent = await readFile(projectId, patch.filePath);

    if (currentContent === null) {
      return {
        success: false,
        filePath: patch.filePath,
        error: 'File does not exist in VFS',
      };
    }

    // Apply patch
    const result = applyPatch(patch, currentContent);

    if (result.success && result.modifiedContent) {
      // Save modified content back to VFS
      await writeFile(projectId, patch.filePath, result.modifiedContent, userId);
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      filePath: patch.filePath,
      error: error.message || 'Unknown error applying patch',
    };
  }
}

/**
 * Apply multiple patches (bundle) to VFS
 */
export async function applyPatchBundleToVFS(
  projectId: string,
  patches: Patch[],
  userId: string = 'agent'
): Promise<PatchResult[]> {
  const results: PatchResult[] = [];

  for (const patch of patches) {
    const result = await applyPatchToVFS(projectId, patch, userId);
    results.push(result);
  }

  return results;
}

/**
 * Get directory structure
 */
export async function getDirectoryStructure(projectId: string): Promise<VFSDirectory> {
  const files = await listFiles(projectId);

  const fileSet = new Set<string>();
  const dirSet = new Set<string>();

  files.forEach(file => {
    fileSet.add(file.path);

    // Extract directories
    const parts = file.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      if (dir) {
        dirSet.add(dir);
      }
    }
  });

  return {
    path: '/',
    files: Array.from(fileSet),
    directories: Array.from(dirSet),
  };
}

/**
 * Encode file path for Firestore document ID
 * Firestore doesn't allow / in document IDs, so we encode it
 */
function encodeFilePath(filePath: string): string {
  return filePath.replace(/\//g, '__SLASH__');
}

/**
 * Decode file path from Firestore document ID
 */
function decodeFilePath(encodedPath: string): string {
  return encodedPath.replace(/__SLASH__/g, '/');
}

/**
 * Get file metadata without content
 */
export async function getFileMetadata(
  projectId: string,
  filePath: string
): Promise<Omit<VFSFile, 'content'> | null> {
  try {
    const fileDoc = await getDoc(doc(db, `projects/${projectId}/vfs/${encodeFilePath(filePath)}`));

    if (!fileDoc.exists()) {
      return null;
    }

    const data = fileDoc.data() as VFSFile;
    const { content, ...metadata } = data;
    return metadata;
  } catch (error) {
    console.error(`[VFS] Error getting file metadata ${filePath}:`, error);
    return null;
  }
}
