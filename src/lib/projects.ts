// src/lib/projects.ts
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

/**
 * Check if a project name already exists for a specific user
 * @param ownerUid - The user's UID
 * @param name - The project name to check
 * @returns true if the name already exists, false otherwise
 */
export async function projectNameExistsForUser(
  ownerUid: string,
  name: string
): Promise<boolean> {
  const trimmed = name.trim();

  if (!trimmed) return false;

  const projectsRef = collection(db, "ops_projects");
  const q = query(
    projectsRef,
    where("ownerUid", "==", ownerUid),
    where("name", "==", trimmed)
  );

  const snap = await getDocs(q);
  return !snap.empty;
}
