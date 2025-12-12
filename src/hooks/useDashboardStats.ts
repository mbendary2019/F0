'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseClient';

type PlanType = 'starter' | 'pro' | 'ultimate';

export function useDashboardStats() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [totalProjects, setTotalProjects] = useState(0);
  const [projectsDelta, setProjectsDelta] = useState(0);
  const [deployments, setDeployments] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [plan, setPlan] = useState<PlanType>('starter');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        // مش لوج إن → reset
        setTotalProjects(0);
        setProjectsDelta(0);
        setDeployments(0);
        setTokens(0);
        setPlan('starter');
        setLoading(false);
        return;
      }

      try {
        const uid = firebaseUser.uid;

        // ----------------------------
        // 1) Projects stats (من ops_projects)
        // ----------------------------
        const projectsRef = collection(db, 'ops_projects');
        const qProjects = query(projectsRef, where('ownerUid', '==', uid));
        const projectsSnap = await getDocs(qProjects);

        let count = 0;
        let delta = 0;
        const now = Date.now();
        const sevenDaysAgoMs = now - 7 * 24 * 60 * 60 * 1000;

        projectsSnap.forEach((docSnap) => {
          count += 1;
          const data: any = docSnap.data();

          let createdMs: number | null = null;

          const createdAt = data?.createdAt;

          if (createdAt instanceof Timestamp) {
            createdMs = createdAt.toMillis();
          } else if (typeof createdAt === 'number') {
            // من النوع number زي اللي في ops_projects
            createdMs = createdAt;
          } else if (typeof createdAt === 'string') {
            const parsed = Date.parse(createdAt);
            if (!Number.isNaN(parsed)) createdMs = parsed;
          }

          if (createdMs !== null && createdMs >= sevenDaysAgoMs) {
            delta += 1;
          }
        });

        setTotalProjects(count);
        setProjectsDelta(delta);

        // ----------------------------
        // 2) Deployments count
        // ----------------------------
        const deploymentsRef = collection(db, 'deployments');
        const deploymentsSnap = await getDocs(deploymentsRef);
        setDeployments(deploymentsSnap.size);

        // ----------------------------
        // 3) Wallet (tokens + plan)
        // ----------------------------
        const walletRef = doc(db, 'wallets', uid);
        const walletSnap = await getDoc(walletRef);

        if (walletSnap.exists()) {
          const wData: any = walletSnap.data();
          const balance = typeof wData.balance === 'number' ? wData.balance : 0;
          const rawPlan = (wData.plan || 'starter') as PlanType;

          setTokens(balance);
          setPlan(
            rawPlan === 'pro'
              ? 'pro'
              : rawPlan === 'ultimate'
              ? 'ultimate'
              : 'starter'
          );
        } else {
          // لو مافيش Wallet → أنشئ واحد افتراضي (0 توكن – Starter)
          // القواعد تسمح لأن docId = uid
          await import('firebase/firestore').then(({ setDoc }) =>
            setDoc(walletRef, {
              balance: 0,
              plan: 'starter',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            })
          );
          setTokens(0);
          setPlan('starter');
        }
      } catch (err) {
        console.error('[useDashboardStats] error', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return {
    loading,
    user,
    totalProjects,
    projectsDelta,
    deployments,
    tokens,
    plan,
  };
}
