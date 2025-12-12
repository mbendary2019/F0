'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type AppType = 'web' | 'mobile' | 'desktop';
type MobileTarget = 'ios' | 'android';
type DesktopTarget = 'mac' | 'windows' | 'linux';

export interface F0Project {
  id: string;
  name: string;
  type?: AppType | 'fullstack' | 'api' | string;
  appType?: AppType;
  appTypes?: AppType[];
  mobileTargets?: MobileTarget[];
  desktopTargets?: DesktopTarget[];
  status: 'active' | 'draft' | 'archived' | string;
  lastUpdatedAt?: number;
  createdAt?: number;
}

export function useUserProjects() {
  const [projects, setProjects] = useState<F0Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'ops_projects'),
      where('ownerUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: F0Project[] = snap.docs.map((doc) => {
          const data = doc.data() as any;

          // Extract appTypes array with backward compatibility
          let appTypes: AppType[] | undefined;
          if (Array.isArray(data.appTypes)) {
            appTypes = data.appTypes.filter(Boolean) as AppType[];
          }

          // Extract mobileTargets array
          let mobileTargets: MobileTarget[] | undefined;
          if (Array.isArray(data.mobileTargets)) {
            mobileTargets = data.mobileTargets.filter(Boolean) as MobileTarget[];
          }

          // Extract desktopTargets array
          let desktopTargets: DesktopTarget[] | undefined;
          if (Array.isArray(data.desktopTargets)) {
            desktopTargets = data.desktopTargets.filter(Boolean) as DesktopTarget[];
          }

          return {
            id: doc.id,
            name: data.name || data.projectName || 'Untitled project',
            // Backward compatibility fields
            type: data.type || data.templateType || data.appType || 'web',
            appType: data.appType,
            // New multi-select fields
            appTypes,
            mobileTargets,
            desktopTargets,
            status: data.status || 'active',
            lastUpdatedAt: data.updatedAt || data.lastUpdatedAt || data.createdAt,
            createdAt: data.createdAt,
          };
        });
        setProjects(list);
        setLoading(false);
      },
      (err) => {
        console.error('[useUserProjects] error', err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  return { projects, loading };
}
