// src/components/ide/InlineAceButton.tsx
// =============================================================================
// Phase 153.1 – Inline ACE Button
// Small floating button that appears next to cursor/selection
// =============================================================================

'use client';

import { cn } from '@/lib/utils';

type InlineAceButtonProps = {
  top: number;
  left: number;
  onClick: () => void;
  locale?: 'en' | 'ar';
};

export function InlineAceButton({
  top,
  left,
  onClick,
  locale = 'en',
}: InlineAceButtonProps) {
  const isArabic = locale === 'ar';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'absolute z-20',
        'px-2.5 py-1',
        'text-[10px] font-medium',
        'rounded-full',
        'shadow-lg shadow-purple-500/20',
        'bg-gradient-to-r from-purple-600 to-purple-500',
        'text-white',
        'hover:from-purple-500 hover:to-purple-400',
        'active:scale-95',
        'transition-all duration-150',
        'flex items-center gap-1.5',
        'cursor-pointer',
        'border border-purple-400/30'
      )}
      style={{
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translateY(-50%)',
      }}
      title={isArabic ? 'اسأل ACE عن هذا الكود' : 'Ask ACE about this code'}
    >
      {/* Sparkle icon */}
      <span className="text-[11px]">✨</span>
      <span>{isArabic ? 'اسأل ACE' : 'Ask ACE'}</span>
    </button>
  );
}

export default InlineAceButton;
