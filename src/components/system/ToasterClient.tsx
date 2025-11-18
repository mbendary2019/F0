'use client';

import { Toaster } from 'sonner';

/**
 * Client-only Toaster component
 * MUST be imported with dynamic() and ssr: false in layouts
 *
 * @example
 * ```tsx
 * // In layout.tsx (Server Component)
 * import dynamic from 'next/dynamic';
 * const ToasterClient = dynamic(() => import('@/components/system/ToasterClient'), { ssr: false });
 * ```
 */
export default function ToasterClient() {
  return (
    <Toaster
      richColors
      position="top-right"
      expand={false}
      closeButton
      toastOptions={{
        className: 'toast-item',
        duration: 4000,
      }}
    />
  );
}
