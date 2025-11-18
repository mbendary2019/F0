"use client";

import { useEffect, useState } from "react";
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth } from "@/lib/firebaseClient";

/**
 * Workspace Data Interface
 */
export interface Workspace {
  id: string;
  name: string;
  ownerUid: string;
  planTier: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Member Data Interface
 */
export interface Member {
  id: string; // User ID
  role: "owner" | "admin" | "member" | "viewer";
  status: "active" | "invited" | "revoked";
  invitedBy?: string;
  joinedAt?: Date;
  updatedAt?: Date;
}

/**
 * Hook to fetch and subscribe to a single workspace
 *
 * @param wsId - Workspace ID
 * @returns Workspace data or null
 *
 * @example
 * ```tsx
 * const workspace = useWorkspace(wsId);
 * if (!workspace) return <div>Loading...</div>;
 * return <div>{workspace.name}</div>;
 * ```
 */
export function useWorkspace(wsId?: string | null): Workspace | null {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    if (!wsId) {
      setWorkspace(null);
      return;
    }

    const db = getFirestore();
    const wsRef = doc(db, "workspaces", wsId);

    const unsubscribe = onSnapshot(
      wsRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setWorkspace({
            id: snap.id,
            name: data.name,
            ownerUid: data.ownerUid,
            planTier: data.planTier || "free",
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
        } else {
          setWorkspace(null);
        }
      },
      (error) => {
        console.error("Workspace subscription error:", error);
        setWorkspace(null);
      }
    );

    return () => unsubscribe();
  }, [wsId]);

  return workspace;
}

/**
 * Hook to fetch and subscribe to workspace members
 *
 * @param wsId - Workspace ID
 * @returns Array of members
 *
 * @example
 * ```tsx
 * const members = useMembers(wsId);
 * return (
 *   <ul>
 *     {members.map(m => (
 *       <li key={m.id}>{m.id} - {m.role}</li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useMembers(wsId?: string | null): Member[] {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (!wsId) {
      setMembers([]);
      return;
    }

    const db = getFirestore();
    const membersRef = collection(db, `workspaces/${wsId}/members`);

    const unsubscribe = onSnapshot(
      membersRef,
      (snapshot) => {
        const memberList: Member[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          memberList.push({
            id: doc.id,
            role: data.role,
            status: data.status || "active",
            invitedBy: data.invitedBy,
            joinedAt: data.joinedAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          });
        });

        // Sort: owner first, then by role, then by join date
        memberList.sort((a, b) => {
          const roleOrder = { owner: 0, admin: 1, member: 2, viewer: 3 };
          const aOrder = roleOrder[a.role] || 999;
          const bOrder = roleOrder[b.role] || 999;

          if (aOrder !== bOrder) return aOrder - bOrder;

          if (a.joinedAt && b.joinedAt) {
            return a.joinedAt.getTime() - b.joinedAt.getTime();
          }

          return 0;
        });

        setMembers(memberList);
      },
      (error) => {
        console.error("Members subscription error:", error);
        setMembers([]);
      }
    );

    return () => unsubscribe();
  }, [wsId]);

  return members;
}

/**
 * Hook to fetch user's workspaces
 *
 * Returns all workspaces where the current user is a member.
 *
 * @returns Array of workspaces
 *
 * @example
 * ```tsx
 * const workspaces = useUserWorkspaces();
 * return (
 *   <ul>
 *     {workspaces.map(ws => (
 *       <li key={ws.id}>{ws.name}</li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useUserWorkspaces(): Workspace[] {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    const db = getFirestore();

    // Fetch all workspaces where user is a member
    const fetchWorkspaces = async () => {
      try {
        // Get all workspace IDs where user is a member
        // This requires a collection group query on members
        const membersQuery = query(
          collection(db, "workspaces"),
          where("__name__", "!=", "") // This is a workaround - we'll improve this
        );

        const snapshot = await getDocs(membersQuery);
        const wsPromises: Promise<Workspace | null>[] = [];

        // For each workspace, check if user is a member
        snapshot.forEach((wsDoc) => {
          const checkMembership = async (): Promise<Workspace | null> => {
            const memberDoc = await getDocs(
              query(
                collection(db, `workspaces/${wsDoc.id}/members`),
                where("__name__", "==", user.uid)
              )
            );

            if (!memberDoc.empty) {
              const data = wsDoc.data();
              return {
                id: wsDoc.id,
                name: data.name,
                ownerUid: data.ownerUid,
                planTier: data.planTier || "free",
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
              };
            }

            return null;
          };

          wsPromises.push(checkMembership());
        });

        const results = await Promise.all(wsPromises);
        const validWorkspaces = results.filter(
          (ws): ws is Workspace => ws !== null
        );

        setWorkspaces(validWorkspaces);
      } catch (error) {
        console.error("Error fetching workspaces:", error);
        setWorkspaces([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, []);

  return workspaces;
}

/**
 * Hook to get current user's role in a workspace
 *
 * @param wsId - Workspace ID
 * @returns User's role or null
 *
 * @example
 * ```tsx
 * const role = useMyRole(wsId);
 * if (role === 'owner' || role === 'admin') {
 *   return <AdminPanel />;
 * }
 * ```
 */
export function useMyRole(wsId?: string | null): Member["role"] | null {
  const members = useMembers(wsId);
  const user = auth.currentUser;

  if (!user || !wsId) return null;

  const myMember = members.find((m) => m.id === user.uid);
  return myMember?.role || null;
}
