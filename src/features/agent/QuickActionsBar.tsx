// src/features/agent/QuickActionsBar.tsx
// Phase 80: AI Quick Actions - UI Component

'use client';

import { useState } from 'react';
import { QuickActionConfig, getTopQuickActions, getAllQuickActions } from '@/config/quickActions';

interface QuickActionsBarProps {
  onRun: (action: QuickActionConfig) => void;
  locale?: 'ar' | 'en';
  maxVisible?: number;
  disabled?: boolean;
}

export function QuickActionsBar({
  onRun,
  locale = 'en',
  maxVisible = 4,
  disabled = false,
}: QuickActionsBarProps) {
  const [showAll, setShowAll] = useState(false);
  const allActions = getAllQuickActions();
  const visibleActions = showAll ? allActions : getTopQuickActions(maxVisible);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {locale === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
        </h3>
        {allActions.length > maxVisible && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-blue-500 hover:text-blue-600"
          >
            {showAll
              ? locale === 'ar'
                ? 'إخفاء'
                : 'Show Less'
              : locale === 'ar'
              ? `عرض الكل (${allActions.length})`
              : `Show All (${allActions.length})`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleActions.map((action) => (
          <button
            key={action.id}
            onClick={() => onRun(action)}
            disabled={disabled}
            className="group relative inline-flex items-center gap-1.5 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={locale === 'ar' ? action.descriptionAr : action.descriptionEn}
          >
            {action.icon && <span className="text-sm">{action.icon}</span>}
            <span>{locale === 'ar' ? action.labelAr : action.labelEn}</span>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
              <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 max-w-xs whitespace-normal shadow-lg">
                {locale === 'ar' ? action.descriptionAr : action.descriptionEn}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact version for sidebar or minimal spaces
 */
export function QuickActionsCompact({
  onRun,
  locale = 'en',
}: {
  onRun: (action: QuickActionConfig) => void;
  locale?: 'ar' | 'en';
}) {
  const topActions = getTopQuickActions(3);

  return (
    <div className="flex gap-1">
      {topActions.map((action) => (
        <button
          key={action.id}
          onClick={() => onRun(action)}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={locale === 'ar' ? action.labelAr : action.labelEn}
        >
          <span className="text-lg">{action.icon || '⚡'}</span>
        </button>
      ))}
    </div>
  );
}
