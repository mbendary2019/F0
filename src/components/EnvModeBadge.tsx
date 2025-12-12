/**
 * Phase 82: Unified Environment Management - Badge Component
 * Displays current environment mode with toggle dropdown
 */

'use client';

import React, { useState } from 'react';
import { useEnvMode } from '@/contexts/EnvModeContext';
import type { EnvMode } from '@/types/env';

export function EnvModeBadge() {
  const { mode, resolved, setMode } = useEnvMode();
  const [isOpen, setIsOpen] = useState(false);

  // Get display text for current effective environment
  const effectiveText = resolved.effective === 'emulator' ? '🔧 Emulator' : '☁️ Cloud';

  // Get color based on effective environment
  const badgeColor = resolved.effective === 'emulator'
    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
    : 'bg-blue-100 text-blue-800 border-blue-300';

  const handleModeChange = (newMode: EnvMode) => {
    setMode(newMode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-md border text-xs font-medium flex items-center gap-2 transition-colors ${badgeColor} hover:opacity-80`}
      >
        <span>{effectiveText}</span>
        <span className="text-[10px] opacity-70">({mode})</span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-3 border-b border-gray-200">
              <div className="text-xs font-semibold text-gray-700 mb-1">Environment Mode</div>
              <div className="text-[11px] text-gray-500">
                Current: {effectiveText}
              </div>
            </div>

            <div className="p-2">
              {/* Auto Mode */}
              <button
                onClick={() => handleModeChange('auto')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-start gap-3 transition-colors ${
                  mode === 'auto'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-base">🔄</span>
                <div className="flex-1">
                  <div className="font-medium">Auto</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Emulator on localhost, Cloud otherwise
                  </div>
                </div>
                {mode === 'auto' && (
                  <span className="text-green-600 text-lg">✓</span>
                )}
              </button>

              {/* Emulator Mode */}
              <button
                onClick={() => handleModeChange('emulator')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-start gap-3 transition-colors mt-1 ${
                  mode === 'emulator'
                    ? 'bg-yellow-50 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-base">🔧</span>
                <div className="flex-1">
                  <div className="font-medium">Emulator</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Always use local emulators
                  </div>
                </div>
                {mode === 'emulator' && (
                  <span className="text-green-600 text-lg">✓</span>
                )}
              </button>

              {/* Cloud Mode */}
              <button
                onClick={() => handleModeChange('cloud')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-start gap-3 transition-colors mt-1 ${
                  mode === 'cloud'
                    ? 'bg-blue-50 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-base">☁️</span>
                <div className="flex-1">
                  <div className="font-medium">Cloud</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Always use Firebase Cloud
                  </div>
                </div>
                {mode === 'cloud' && (
                  <span className="text-green-600 text-lg">✓</span>
                )}
              </button>
            </div>

            <div className="p-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <div className="text-[10px] text-gray-500 text-center">
                Page will reload when mode changes
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
