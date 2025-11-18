// src/app/ops/incidents/page.tsx
/**
 * Phase 49: Incidents Dashboard
 * Simple dashboard (Client Component) that reads from Firestore
 * and displays recent incidents with Acknowledge/Resolve actions
 * (requires Admin permissions per Firestore rules)
 */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { logInfo, logWarn, logError } from '@/lib/logger';

type Incident = {
  fingerprint: string;
  service?: string;
  message?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  eventCount: number;
  firstSeen: number;
  lastSeen: number;
  updatedAt: number;
};

function getFirebaseApp(): FirebaseApp {
  const cfgRaw = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  const cfg = cfgRaw ? JSON.parse(cfgRaw) : undefined;

  const config =
    cfg ??
    ({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'dev',
      authDomain:
        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID + '.firebaseapp.com',
    } as any);

  if (getApps().length) return getApp();
  return initializeApp(config);
}

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function chipColor(sev: Incident['severity']) {
  switch (sev) {
    case 'critical':
      return 'bg-red-600 text-white';
    case 'high':
      return 'bg-orange-500 text-white';
    case 'medium':
      return 'bg-amber-400 text-black';
    default:
      return 'bg-gray-300 text-black';
  }
}

function statusColor(st: Incident['status']) {
  switch (st) {
    case 'resolved':
      return 'bg-emerald-600 text-white';
    case 'acknowledged':
      return 'bg-sky-600 text-white';
    default:
      return 'bg-zinc-400 text-black';
  }
}

export default function IncidentsPage() {
  const app = useMemo(getFirebaseApp, []);
  const db = useMemo(() => getFirestore(app), [app]);

  const [incidents, setIncidents] = useState<
    (Incident & { id: string })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'ops_incidents'),
      orderBy('updatedAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list =
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Incident) })) ?? [];
        setIncidents(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [db]);

  const act = async (
    id: string,
    status: Incident['status'],
    note?: string,
  ) => {
    try {
      await updateDoc(doc(db, 'ops_incidents', id), {
        status,
        updatedAt: Date.now(),
      });

      if (status === 'resolved') {
        await logInfo('Incident ' + id + ' resolved', {
          service: 'dashboard',
          context: { note },
        });
      } else if (status === 'acknowledged') {
        await logWarn('Incident ' + id + ' acknowledged', {
          service: 'dashboard',
          context: { note },
        });
      }
    } catch (e: any) {
      console.error(e);
      await logError('Failed to update incident ' + id, {
        service: 'dashboard',
        code: 500,
        context: { error: String(e?.message ?? e) },
      });
      alert('Update failed. Do you have admin rights?');
    }
  };

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Incidents</h1>
        <div className="text-sm text-zinc-500">
          {loading ? 'Loading…' : incidents.length + ' item(s)'}
        </div>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left">
            <tr className="border-b">
              <th className="p-3">Severity</th>
              <th className="p-3">Status</th>
              <th className="p-3">Message</th>
              <th className="p-3">Service</th>
              <th className="p-3">Count</th>
              <th className="p-3">First Seen</th>
              <th className="p-3">Last Seen</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id} className="border-b hover:bg-zinc-50">
                <td className="p-3">
                  <span
                    className={'inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ' + chipColor(i.severity)}
                  >
                    {i.severity.toUpperCase()}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={'inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ' + statusColor(i.status)}
                  >
                    {i.status}
                  </span>
                </td>
                <td className="p-3">
                  <div className="line-clamp-2 max-w-[380px]">{i.message}</div>
                  <div className="text-[10px] text-zinc-400 mt-1">
                    {i.fingerprint}
                  </div>
                </td>
                <td className="p-3">{i.service ?? '-'}</td>
                <td className="p-3">{i.eventCount ?? 1}</td>
                <td className="p-3">{formatTime(i.firstSeen)}</td>
                <td className="p-3">{formatTime(i.lastSeen)}</td>
                <td className="p-3 space-x-2">
                  <button
                    className="rounded-xl px-3 py-1 text-xs border hover:bg-sky-50"
                    onClick={() => act(i.id, 'acknowledged')}
                    disabled={i.status !== 'open'}
                    title="Acknowledge"
                  >
                    Acknowledge
                  </button>
                  <button
                    className="rounded-xl px-3 py-1 text-xs border hover:bg-emerald-50"
                    onClick={() => act(i.id, 'resolved')}
                    disabled={i.status === 'resolved'}
                    title="Resolve"
                  >
                    Resolve
                  </button>
                </td>
              </tr>
            ))}
            {!loading && incidents.length === 0 && (
              <tr>
                <td className="p-6 text-center text-zinc-500" colSpan={8}>
                  No incidents yet. Run the local tests to generate some events.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="text-xs text-zinc-500">
        <p>
          This dashboard requires admin privileges to update incidents (per
          Firestore rules). On the emulator, ensure your user has{' '}
          <code>token.admin = true</code>.
        </p>
      </section>
    </main>
  );
}
