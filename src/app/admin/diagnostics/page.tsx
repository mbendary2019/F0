'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';

interface DiagnosticInfo {
  environment: 'development' | 'production';
  appCheck: {
    enabled: boolean;
    debugToken: boolean;
  };
  firebase: {
    projectId: string;
    authDomain: string;
  };
  auth: {
    currentUser: any;
    claims: any;
  };
  runtime: {
    nodeVersion?: string;
    platform?: string;
    userAgent: string;
  };
}

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const claims = user ? await user.getIdTokenResult() : null;

      const info: DiagnosticInfo = {
        environment: process.env.NODE_ENV as any,
        appCheck: {
          enabled: !!process.env.NEXT_PUBLIC_APPCHECK_SITE_KEY,
          debugToken: process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN === 'true',
        },
        firebase: {
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'not-set',
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'not-set',
        },
        auth: {
          currentUser: user
            ? {
                uid: user.uid,
                email: user.email,
                emailVerified: user.emailVerified,
                displayName: user.displayName,
              }
            : null,
          claims: claims?.claims || null,
        },
        runtime: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
      };

      setDiagnostics(info);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">System Diagnostics</h1>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">System Diagnostics</h1>

        {/* Environment */}
        <Section title="Environment">
          <Item
            label="Mode"
            value={diagnostics?.environment || 'unknown'}
            status={diagnostics?.environment === 'production' ? 'ok' : 'info'}
          />
        </Section>

        {/* App Check */}
        <Section title="App Check">
          <Item
            label="Enabled"
            value={diagnostics?.appCheck.enabled ? 'Yes' : 'No'}
            status={diagnostics?.appCheck.enabled ? 'ok' : 'warning'}
          />
          <Item
            label="Debug Token"
            value={diagnostics?.appCheck.debugToken ? 'Yes (Dev Only)' : 'No'}
            status={diagnostics?.appCheck.debugToken ? 'info' : 'ok'}
          />
        </Section>

        {/* Firebase */}
        <Section title="Firebase Configuration">
          <Item label="Project ID" value={diagnostics?.firebase.projectId || 'not-set'} />
          <Item label="Auth Domain" value={diagnostics?.firebase.authDomain || 'not-set'} />
        </Section>

        {/* Authentication */}
        <Section title="Authentication">
          {diagnostics?.auth.currentUser ? (
            <>
              <Item label="Status" value="Signed In" status="ok" />
              <Item label="UID" value={diagnostics.auth.currentUser.uid} />
              <Item label="Email" value={diagnostics.auth.currentUser.email || 'N/A'} />
              <Item
                label="Email Verified"
                value={diagnostics.auth.currentUser.emailVerified ? 'Yes' : 'No'}
                status={diagnostics.auth.currentUser.emailVerified ? 'ok' : 'warning'}
              />
              {diagnostics.auth.claims && (
                <Item
                  label="Custom Claims"
                  value={JSON.stringify(diagnostics.auth.claims, null, 2)}
                  monospace
                />
              )}
            </>
          ) : (
            <Item label="Status" value="Not Signed In" status="warning" />
          )}
        </Section>

        {/* Runtime */}
        <Section title="Runtime Information">
          <Item label="User Agent" value={diagnostics?.runtime.userAgent || 'unknown'} />
          <Item label="Platform" value={diagnostics?.runtime.platform || 'unknown'} />
        </Section>

        {/* Actions */}
        <div className="mt-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
            >
              Refresh Diagnostics
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 mr-2"
            >
              Copy to Clipboard
            </button>
            <a
              href="/admin"
              className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Back to Admin
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Item({
  label,
  value,
  status,
  monospace,
}: {
  label: string;
  value: string;
  status?: 'ok' | 'warning' | 'error' | 'info';
  monospace?: boolean;
}) {
  const statusColors = {
    ok: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
    info: 'text-blue-600',
  };

  const statusIcons = {
    ok: '✓',
    warning: '⚠',
    error: '✗',
    info: 'ℹ',
  };

  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
      <span className="font-medium text-gray-700">{label}:</span>
      <span
        className={`text-right ${monospace ? 'font-mono text-xs' : ''} ${
          status ? statusColors[status] : 'text-gray-900'
        }`}
      >
        {status && <span className="mr-1">{statusIcons[status]}</span>}
        {monospace ? <pre className="whitespace-pre-wrap">{value}</pre> : value}
      </span>
    </div>
  );
}
