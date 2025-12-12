// src/components/ui/use-toast.ts
// Hook wrapper for sonner toast
'use client';

import { toast as sonnerToast } from 'sonner';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  duration?: number;
}

export function useToast() {
  const toast = ({ title, description, variant = 'default', duration }: ToastOptions) => {
    const message = title || description || '';
    const fullMessage = title && description ? `${title}\n${description}` : message;

    switch (variant) {
      case 'success':
        return sonnerToast.success(fullMessage, { duration });
      case 'error':
        return sonnerToast.error(fullMessage, { duration });
      case 'warning':
        return sonnerToast.warning(fullMessage, { duration });
      default:
        return sonnerToast(fullMessage, { duration });
    }
  };

  return { toast };
}
