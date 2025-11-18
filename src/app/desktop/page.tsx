/**
 * F0 Desktop App Page
 * Electron renderer UI for autonomous ops control
 */

'use client';

import { useEffect, useState } from 'react';

// Type for window.f0 API (exposed by Electron preload)
declare global {
  interface Window {
    f0?: {
      execute: (cmd: string, args?: string[], cwd?: string) => Promise<any>;
      telemetry: () => Promise<any>;
      execSafe: (cmd: string) => Promise<any>;
      getAppInfo: () => Promise<any>;
    };
  }
}

export default function DesktopPage() {
  const [isElectron, setIsElectron] = useState(false);
  const [appInfo, setAppInfo] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [commandOutput, setCommandOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    if (typeof window !== 'undefined' && window.f0) {
      setIsElectron(true);
      loadAppInfo();
      loadTelemetry();
    }
  }, []);

  async function loadAppInfo() {
    if (!window.f0) return;
    try {
      const info = await window.f0.getAppInfo();
      setAppInfo(info);
    } catch (error) {
      console.error('Failed to load app info:', error);
    }
  }

  async function loadTelemetry() {
    if (!window.f0) return;
    try {
      const stats = await window.f0.telemetry();
      setTelemetry(stats);
    } catch (error) {
      console.error('Failed to load telemetry:', error);
    }
  }

  async function executeCommand(cmd: string, args?: string[]) {
    if (!window.f0) return;
    setLoading(true);
    try {
      const result = await window.f0.execute(cmd, args);
      setCommandOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setCommandOutput(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  async function checkVersion() {
    if (!window.f0) return;
    setLoading(true);
    try {
      const result = await window.f0.execSafe('node -v');
      setCommandOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setCommandOutput(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  if (!isElectron) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">⚠️ Not Running in Electron</h1>
          <p className="text-gray-400 mb-4">
            This page is designed for the desktop app.
          </p>
          <p className="text-sm text-gray-500">
            Please run: <code className="bg-gray-800 px-2 py-1 rounded">pnpm dev:desktop</code>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-gray-800 pb-6">
          <h1 className="text-3xl font-bold mb-2">🖥️ F0 Desktop Control Panel</h1>
          <p className="text-gray-400">Autonomous Ops Desktop Client</p>
        </div>

        {/* App Info */}
        {appInfo && (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-xl font-semibold mb-4">📦 Application Info</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Name</div>
                <div className="font-mono">{appInfo.name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-400">Version</div>
                <div className="font-mono">{appInfo.version || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-400">Platform</div>
                <div className="font-mono">{appInfo.platform || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-400">Electron</div>
                <div className="font-mono">{appInfo.electronVersion || 'N/A'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Telemetry */}
        {telemetry && (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">📊 System Telemetry</h2>
              <button
                onClick={loadTelemetry}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-sm"
              >
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-400">CPU Usage</div>
                <div className="font-mono">{telemetry.cpu?.toFixed(1) || 0}%</div>
              </div>
              <div>
                <div className="text-gray-400">Memory</div>
                <div className="font-mono">{(telemetry.memory / 1024)?.toFixed(1) || 0} GB</div>
              </div>
              <div>
                <div className="text-gray-400">Uptime</div>
                <div className="font-mono">{(telemetry.uptime / 60)?.toFixed(0) || 0} min</div>
              </div>
              <div>
                <div className="text-gray-400">Node.js</div>
                <div className="font-mono">{telemetry.nodeVersion || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-400">Chrome</div>
                <div className="font-mono">{telemetry.chromeVersion?.split('.')[0] || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-400">Architecture</div>
                <div className="font-mono">{telemetry.arch || 'N/A'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Commands */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold mb-4">⚡ Quick Actions</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => executeCommand('hello-world', ['--demo'])}
              disabled={loading}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Execute Demo Command
            </button>
            <button
              onClick={checkVersion}
              disabled={loading}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Check Node Version
            </button>
            <button
              onClick={loadTelemetry}
              disabled={loading}
              className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Refresh Telemetry
            </button>
          </div>

          {/* Output */}
          {commandOutput && (
            <div className="mt-4">
              <div className="text-sm text-gray-400 mb-2">Output:</div>
              <pre className="bg-gray-950 border border-gray-700 rounded p-4 text-xs overflow-x-auto">
                {commandOutput}
              </pre>
            </div>
          )}
        </div>

        {/* Integration Status */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-xl font-semibold mb-4">🔗 Integration Status</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Electron IPC: Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Next.js: Running</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span>F0 SDK: Simulated (TODO: Real integration)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span>Autonomous Ops: Phase 33.3 (TODO: Connect)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 pt-6">
          Phase 28R - Desktop Integration (Step 3)
        </div>
      </div>
    </main>
  );
}


