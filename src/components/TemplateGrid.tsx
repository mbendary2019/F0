/**
 * Phase 78: Developer Mode Assembly - TemplateGrid Component
 * Displays a grid of project templates for selection
 */

'use client';

import type { F0Template } from '@/types/templates';

interface TemplateGridProps {
  templates: F0Template[];
  selectedId?: string | null;
  onSelect: (templateId: string) => void;
}

export function TemplateGrid({ templates, selectedId, onSelect }: TemplateGridProps) {
  if (!templates.length) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-400">No templates available</p>
        <p className="text-xs text-gray-500 mt-1">
          Templates will appear here once they are seeded
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => {
        const isSelected = t.id === selectedId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`text-left border rounded-lg p-4 hover:border-indigo-500 hover:bg-indigo-900/20 transition-all ${
              isSelected
                ? 'border-indigo-500 bg-indigo-900/30 shadow-lg shadow-indigo-500/20'
                : 'border-gray-700 bg-gray-900/40'
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-sm">{t.name}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-700/50 text-indigo-100 uppercase">
                {t.category}
              </span>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-300 line-clamp-3 mb-3">
              {t.description}
            </p>

            {/* Tech Stack */}
            <div className="flex flex-wrap gap-1 mb-3">
              {t.techStack?.slice(0, 3).map((tech) => (
                <span
                  key={tech}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-200"
                >
                  {tech}
                </span>
              ))}
              {t.techStack && t.techStack.length > 3 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                  +{t.techStack.length - 3}
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  t.complexity === 'beginner'
                    ? 'bg-green-900/50 text-green-300'
                    : t.complexity === 'intermediate'
                    ? 'bg-yellow-900/50 text-yellow-300'
                    : 'bg-red-900/50 text-red-300'
                }`}
              >
                {t.complexity}
              </span>
              <span className="text-[10px] text-gray-400 uppercase">
                {t.recommendedPlan}
              </span>
            </div>

            {/* Selection Indicator */}
            {isSelected && (
              <div className="mt-3 flex items-center gap-2 text-indigo-400 text-xs">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Selected</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
