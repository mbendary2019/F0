'use client';

/**
 * Phase 94.3: Project Memory Card
 * Displays structured project memory sections in a card format
 * Shows AGREED_SCOPE, TECH_STACK, ARCHITECTURE, RISKS, CONSTRAINTS, USER_PREFS
 */

import { useState, useEffect, useCallback } from 'react';

interface MemorySection {
  text: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface ProjectMemory {
  sections: Partial<Record<string, MemorySection>>;
}

const SECTION_CONFIG: Record<
  string,
  { label: string; labelAr: string; icon: string; color: string }
> = {
  AGREED_SCOPE: {
    label: 'Agreed Scope',
    labelAr: 'النطاق المتفق عليه',
    icon: '🎯',
    color: 'border-blue-500/30 bg-blue-500/10',
  },
  TECH_STACK: {
    label: 'Tech Stack',
    labelAr: 'التقنيات',
    icon: '⚙️',
    color: 'border-purple-500/30 bg-purple-500/10',
  },
  ARCHITECTURE: {
    label: 'Architecture',
    labelAr: 'البنية',
    icon: '🏗️',
    color: 'border-green-500/30 bg-green-500/10',
  },
  RISKS: {
    label: 'Risks',
    labelAr: 'المخاطر',
    icon: '⚠️',
    color: 'border-yellow-500/30 bg-yellow-500/10',
  },
  CONSTRAINTS: {
    label: 'Constraints',
    labelAr: 'القيود',
    icon: '🔒',
    color: 'border-orange-500/30 bg-orange-500/10',
  },
  USER_PREFS: {
    label: 'User Preferences',
    labelAr: 'تفضيلات المستخدم',
    icon: '👤',
    color: 'border-pink-500/30 bg-pink-500/10',
  },
};

interface ProjectMemoryCardProps {
  projectId: string;
  lang?: 'ar' | 'en';
  className?: string;
  showEmpty?: boolean;
  collapsible?: boolean;
  onUpdate?: () => void;
}

export function ProjectMemoryCard({
  projectId,
  lang = 'ar',
  className = '',
  showEmpty = false,
  collapsible = true,
  onUpdate,
}: ProjectMemoryCardProps) {
  const [memory, setMemory] = useState<ProjectMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const isArabic = lang === 'ar';

  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/memory`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch memory');
      }

      setMemory(data.memory);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  if (loading) {
    return (
      <div className={`bg-black/50 border border-white/10 rounded-lg p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-white/5 rounded"></div>
            <div className="h-16 bg-white/5 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/30 rounded-lg p-4 ${className}`}>
        <p className="text-red-400 text-sm">
          {isArabic ? 'خطأ في تحميل الذاكرة' : 'Error loading memory'}: {error}
        </p>
        <button
          onClick={fetchMemory}
          className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
        >
          {isArabic ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>
    );
  }

  const sections = memory?.sections || {};
  const filledSections = Object.entries(sections).filter(
    ([, section]) => section?.text
  );

  if (filledSections.length === 0 && !showEmpty) {
    return null;
  }

  return (
    <div className={`bg-black/50 border border-white/10 rounded-lg ${className}`}>
      {/* Header */}
      <div
        className={`p-4 flex items-center justify-between ${
          collapsible ? 'cursor-pointer hover:bg-white/5' : ''
        } ${collapsed ? '' : 'border-b border-white/10'}`}
        onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <h3 className="font-medium">
            {isArabic ? 'ذاكرة المشروع' : 'Project Memory'}
          </h3>
          <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
            {filledSections.length} {isArabic ? 'أقسام' : 'sections'}
          </span>
        </div>
        {collapsible && (
          <span className="text-white/40 text-sm">
            {collapsed ? '▼' : '▲'}
          </span>
        )}
      </div>

      {/* Sections */}
      {!collapsed && (
        <div className="p-4 space-y-3">
          {filledSections.length === 0 ? (
            <div className="text-center text-white/40 py-6">
              {isArabic
                ? 'لا توجد ذاكرة مسجلة بعد'
                : 'No memory recorded yet'}
            </div>
          ) : (
            filledSections.map(([key, section]) => {
              const config = SECTION_CONFIG[key];
              if (!config || !section) return null;

              return (
                <div
                  key={key}
                  className={`border rounded-lg p-3 ${config.color}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span>{config.icon}</span>
                    <span className="font-medium text-sm">
                      {isArabic ? config.labelAr : config.label}
                    </span>
                    {section.updatedAt && (
                      <span className="text-xs text-white/40 mr-auto">
                        {new Date(section.updatedAt).toLocaleDateString(
                          isArabic ? 'ar-EG' : 'en-US',
                          { month: 'short', day: 'numeric' }
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/80 whitespace-pre-wrap">
                    {section.text}
                  </p>
                </div>
              );
            })
          )}

          {/* Refresh button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchMemory();
                onUpdate?.();
              }}
              className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1"
            >
              🔄 {isArabic ? 'تحديث' : 'Refresh'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to fetch project memory
 */
export function useProjectMemory(projectId: string | undefined) {
  const [memory, setMemory] = useState<ProjectMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMemory = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/memory`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch memory');
      }

      setMemory(data.memory);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  return {
    memory,
    loading,
    error,
    refresh: fetchMemory,
  };
}

/**
 * Format memory for display in a single line summary
 */
export function formatMemorySummary(
  memory: ProjectMemory | null,
  lang: 'ar' | 'en' = 'ar'
): string {
  if (!memory?.sections) {
    return lang === 'ar' ? 'لا توجد ذاكرة' : 'No memory';
  }

  const parts: string[] = [];

  if (memory.sections.AGREED_SCOPE?.text) {
    parts.push(memory.sections.AGREED_SCOPE.text.substring(0, 50) + '...');
  }

  if (memory.sections.TECH_STACK?.text) {
    parts.push(memory.sections.TECH_STACK.text.substring(0, 30));
  }

  return parts.join(' | ') || (lang === 'ar' ? 'لا توجد ذاكرة' : 'No memory');
}
