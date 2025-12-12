// src/lib/ideProjectFiles.ts

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase"; // Firebase client

export interface IdeFileRecord {
  path: string;        // e.g. "index.ts"
  languageId: string;  // e.g. "typescript"
  content: string;
  updatedAt: number;   // ms timestamp
}

// Encode file path (because Firestore doc IDs can't contain "/" safely for our use)
function pathToDocId(path: string): string {
  return encodeURIComponent(path);
}

function docIdToPath(id: string): string {
  return decodeURIComponent(id);
}

function filesCollection(projectId: string) {
  return collection(firestore, "projects", projectId, "files");
}

/**
 * Load all files for a project from Firestore.
 * If no files exist, the caller can decide to create defaults.
 */
export async function loadProjectFiles(projectId: string): Promise<IdeFileRecord[]> {
  const q = query(filesCollection(projectId), orderBy("path"));
  const snap = await getDocs(q);

  const files: IdeFileRecord[] = [];

  snap.forEach((d) => {
    const data = d.data() as any;
    files.push({
      path: data.path ?? docIdToPath(d.id),
      languageId: data.languageId ?? "plaintext",
      content: data.content ?? "",
      updatedAt: (data.updatedAt instanceof Timestamp)
        ? data.updatedAt.toMillis()
        : (data.updatedAt ?? Date.now()),
    });
  });

  return files;
}

/**
 * Save (upsert) a single file to Firestore.
 */
export async function saveProjectFile(
  projectId: string,
  file: IdeFileRecord
): Promise<void> {
  const ref = doc(filesCollection(projectId), pathToDocId(file.path));
  await setDoc(
    ref,
    {
      path: file.path,
      languageId: file.languageId,
      content: file.content,
      updatedAt: file.updatedAt ?? Date.now(),
    },
    { merge: true }
  );
}

/**
 * Delete a file from Firestore.
 */
export async function deleteProjectFile(
  projectId: string,
  filePath: string
): Promise<void> {
  const ref = doc(filesCollection(projectId), pathToDocId(filePath));
  await deleteDoc(ref);
}
