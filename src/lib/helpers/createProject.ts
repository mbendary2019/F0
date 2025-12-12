// src/lib/helpers/createProject.ts
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';

export interface CreateProjectParams {
  name: string;
  uid: string;
  appType?: string;
  description?: string;
  [key: string]: any;
}

/**
 * Creates a new project for a user, ensuring no duplicate project names exist.
 * @param params - Project creation parameters
 * @throws Error if project name already exists
 * @returns The created project document ID
 */
export async function createProject(params: CreateProjectParams): Promise<string> {
  const { name, uid, ...payload } = params;
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Project name cannot be empty');
  }

  if (!uid) {
    throw new Error('User ID is required');
  }

  // Reference to user's projects collection
  const projectsRef = collection(db, `users/${uid}/projects`);

  // 1) Check if project name already exists
  const q = query(projectsRef, where('name', '==', trimmedName));
  const snap = await getDocs(q);

  if (!snap.empty) {
    throw new Error('اسم المشروع مستخدم بالفعل، اختر اسمًا مختلفًا / Project name already exists, please choose a different name');
  }

  // 2) Create the project
  const docRef = await addDoc(projectsRef, {
    name: trimmedName,
    ...payload,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return docRef.id;
}
