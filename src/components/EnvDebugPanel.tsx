/**
 * Phase 82: Unified Environment Management - Debug Panel
 * Displays detailed environment configuration for debugging
 */

'use client';

import React, { useState } from 'react';
import { useEnvMode } from '@/contexts/EnvModeContext';

export function EnvDebugPanel() {
  const { mode, resolved } = useEnvMode();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-medium hover:bg-gray-700 transition-colors z-50 flex items-center gap-2"
      >
        <span>🔍</span>
        <span>Debug Env</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white border border-gray-300 rounded-lg shadow-2xl z-50">
      {/* Header */}
      <div className="bg-gray-800 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>🔍</span>
          <span className="font-semibold text-sm">Environment Debug Panel</span>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-300 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {/* Mode Section */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">Environment Mode</div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-500">Mode:</div>
              <div className="font-mono font-semibold">{mode}</div>

              <div className="text-gray-500">Effective:</div>
              <div className="font-mono font-semibold">{resolved.effective}</div>

              <div className="text-gray-500">Is Localhost:</div>
              <div className="font-mono font-semibold">{resolved.isLocalhost ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </div>

        {/* Firestore Section */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">Firestore Configuration</div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-500">Use Emulator:</div>
              <div className={`font-mono font-semibold ${resolved.firestore.useEmulator ? 'text-yellow-700' : 'text-blue-700'}`}>
                {resolved.firestore.useEmulator ? 'Yes' : 'No'}
              </div>

              {resolved.firestore.useEmulator && (
                <>
                  <div className="text-gray-500">Host:</div>
                  <div className="font-mono text-xs">{resolved.firestore.host}</div>

                  <div className="text-gray-500">Port:</div>
                  <div className="font-mono text-xs">{resolved.firestore.port}</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Auth Section */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">Auth Configuration</div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-500">Use Emulator:</div>
              <div className={`font-mono font-semibold ${resolved.auth.useEmulator ? 'text-yellow-700' : 'text-blue-700'}`}>
                {resolved.auth.useEmulator ? 'Yes' : 'No'}
              </div>

              {resolved.auth.useEmulator && (
                <>
                  <div className="text-gray-500">URL:</div>
                  <div className="font-mono text-xs break-all">{resolved.auth.url}</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Functions Section */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">Functions Configuration</div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-500">Use Emulator:</div>
              <div className={`font-mono font-semibold ${resolved.functions.useEmulator ? 'text-yellow-700' : 'text-blue-700'}`}>
                {resolved.functions.useEmulator ? 'Yes' : 'No'}
              </div>

              {resolved.functions.useEmulator && (
                <>
                  <div className="text-gray-500">Host:</div>
                  <div className="font-mono text-xs">{resolved.functions.host}</div>

                  <div className="text-gray-500">Port:</div>
                  <div className="font-mono text-xs">{resolved.functions.port}</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Hostname Info */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">Current Hostname</div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="font-mono text-xs break-all">
              {typeof window !== 'undefined' ? window.location.hostname : 'N/A'}
            </div>
          </div>
        </div>

        {/* LocalStorage Value */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-2">LocalStorage Value</div>
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="font-mono text-xs">
              {typeof window !== 'undefined'
                ? (localStorage.getItem('f0_env_mode') || 'Not set')
                : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-4 py-2 rounded-b-lg border-t border-gray-200">
        <div className="text-[10px] text-gray-500 text-center">
          Phase 82: Unified Environment Management
        </div>
      </div>
    </div>
  );
}
