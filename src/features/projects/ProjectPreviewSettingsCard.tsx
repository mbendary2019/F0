// src/features/projects/ProjectPreviewSettingsCard.tsx
// Phase 97.1: Project Preview URL Settings Card

'use client';

import { useState, useEffect } from 'react';
import { useProjectPreviewUrl } from '@/hooks/useProjectPreviewUrl';

interface ProjectPreviewSettingsCardProps {
  projectId: string;
  locale?: 'ar' | 'en';
  /** When true, uses dark theme styling (for F0 settings pages) */
  darkMode?: boolean;
}

export function ProjectPreviewSettingsCard({
  projectId,
  locale = 'en',
  darkMode = true,
}: ProjectPreviewSettingsCardProps) {
  const isArabic = locale === 'ar';
  const { previewUrl, loading, error, updatePreviewUrl, saving } = useProjectPreviewUrl(projectId);

  const [inputValue, setInputValue] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Sync input with fetched value
  useEffect(() => {
    if (previewUrl !== null) {
      setInputValue(previewUrl);
    } else {
      setInputValue('');
    }
  }, [previewUrl]);

  const handleSave = async () => {
    setSuccess(null);
    setLocalError(null);

    // Validate URL format if not empty
    const trimmed = inputValue.trim();
    if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setLocalError(isArabic ? 'يجب أن يبدأ الرابط بـ http:// أو https://' : 'URL must start with http:// or https://');
      return;
    }

    const newUrl = trimmed || null;
    const result = await updatePreviewUrl(newUrl);

    if (result) {
      setSuccess(isArabic ? 'تم الحفظ بنجاح' : 'Saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleClear = async () => {
    setSuccess(null);
    setLocalError(null);

    const result = await updatePreviewUrl(null);
    if (result) {
      setInputValue('');
      setSuccess(isArabic ? 'تم مسح رابط المعاينة' : 'Preview URL cleared');
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const labels = isArabic
    ? {
        urlLabel: 'رابط المعاينة (Preview URL)',
        urlPlaceholder: 'مثال: http://localhost:3001 أو https://myapp.vercel.app',
        urlHelp: 'أدخل رابط التطبيق الذي يعمل محلياً أو في الإنتاج لعرض المعاينة في لوحة الأجهزة.',
        saveButton: 'حفظ',
        savingButton: 'جاري الحفظ...',
        clearButton: 'مسح',
        currentUrl: 'الرابط الحالي:',
        noUrl: 'لم يتم تعيين رابط معاينة',
      }
    : {
        urlLabel: 'Preview URL',
        urlPlaceholder: 'e.g., http://localhost:3001 or https://myapp.vercel.app',
        urlHelp: 'Enter the URL where your app is running locally or in production to show preview in the Device Preview pane.',
        saveButton: 'Save',
        savingButton: 'Saving...',
        clearButton: 'Clear',
        currentUrl: 'Current URL:',
        noUrl: 'No preview URL set',
      };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className={`h-10 w-full rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-gray-200'}`}></div>
        <div className={`h-4 w-48 rounded ${darkMode ? 'bg-slate-700/30' : 'bg-gray-100'}`}></div>
      </div>
    );
  }

  // Dark mode styles (for F0 settings pages)
  const inputClass = darkMode
    ? 'flex-1 rounded-xl bg-slate-950/40 border border-slate-700/70 px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/80 focus:border-transparent placeholder:text-slate-500'
    : 'flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent';

  const labelClass = darkMode
    ? 'text-xs uppercase tracking-wide text-slate-400'
    : 'block text-sm font-medium text-gray-700';

  const helpTextClass = darkMode
    ? 'text-xs text-slate-500'
    : 'text-xs text-gray-500';

  const saveButtonClass = darkMode
    ? 'inline-flex items-center rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition shadow-[0_0_15px_rgba(236,72,153,0.5)]'
    : 'inline-flex items-center rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

  const clearButtonClass = darkMode
    ? 'inline-flex items-center rounded-full border border-slate-600/70 bg-slate-950/40 text-slate-200 px-4 py-2 text-sm font-medium hover:border-slate-500/70 disabled:opacity-50 disabled:cursor-not-allowed transition'
    : 'inline-flex items-center rounded-lg border border-gray-300 bg-white text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="space-y-4">
      {/* URL Input */}
      <div className="space-y-2">
        <label className={labelClass}>
          {labels.urlLabel}
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            className={inputClass}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setLocalError(null);
              setSuccess(null);
            }}
            placeholder={labels.urlPlaceholder}
            disabled={saving}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={saveButtonClass}
          >
            {saving ? labels.savingButton : labels.saveButton}
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={handleClear}
              disabled={saving}
              className={clearButtonClass}
            >
              {labels.clearButton}
            </button>
          )}
        </div>
        <p className={helpTextClass}>
          {labels.urlHelp}
        </p>
      </div>

      {/* Status Indicator */}
      <div className={`flex items-center gap-2 text-sm ${darkMode ? 'text-slate-300' : ''}`}>
        {previewUrl ? (
          <>
            <span className="text-emerald-400">
              <svg className="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </span>
            <span className={darkMode ? 'text-slate-400' : 'text-gray-600'}>
              {labels.currentUrl}{' '}
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${darkMode ? 'text-fuchsia-400 hover:text-fuchsia-300' : 'text-violet-600 hover:underline'} font-mono text-xs`}
              >
                {previewUrl}
              </a>
            </span>
          </>
        ) : (
          <>
            <span className={darkMode ? 'text-slate-500' : 'text-gray-400'}>
              <svg className="w-4 h-4 inline-block" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </span>
            <span className={darkMode ? 'text-slate-500' : 'text-gray-500'}>
              {labels.noUrl}
            </span>
          </>
        )}
      </div>

      {/* Error Message */}
      {(error || localError) && (
        <div className={`rounded-lg p-3 ${darkMode ? 'bg-red-950/40 border border-red-500/40' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-700'}`}>
            {localError || error}
          </p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className={`rounded-lg p-3 ${darkMode ? 'bg-emerald-950/40 border border-emerald-500/40' : 'bg-green-50 border border-green-200'}`}>
          <p className={`text-sm ${darkMode ? 'text-emerald-400' : 'text-green-700'}`}>
            {success}
          </p>
        </div>
      )}
    </div>
  );
}
