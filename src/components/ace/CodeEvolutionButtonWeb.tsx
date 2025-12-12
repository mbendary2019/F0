// src/components/ace/CodeEvolutionButtonWeb.tsx
// =============================================================================
// Phase 150.1 – Web Code Evolution Button (synced with Desktop Design)
// =============================================================================
'use client';

import React, { useState } from 'react';
import { CodeEvolutionModalWeb } from './CodeEvolutionModalWeb';

interface CodeEvolutionButtonWebProps {
  locale?: 'en' | 'ar';
}

export function CodeEvolutionButtonWeb({ locale = 'en' }: CodeEvolutionButtonWebProps) {
  const [open, setOpen] = useState(false);
  const isArabic = locale === 'ar';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-purple-600/80 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-purple-700/40 hover:bg-purple-500 transition flex items-center gap-1.5"
      >
        <span className="text-sm">🧬</span>
        {isArabic ? 'تطور الكود' : 'Code Evolution'}
      </button>

      {open && (
        <CodeEvolutionModalWeb
          onClose={() => setOpen(false)}
          locale={locale}
        />
      )}
    </>
  );
}
