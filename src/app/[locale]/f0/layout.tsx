import type { ReactNode } from 'react';
import F0Shell from '@/components/f0/F0Shell';

export default function F0Layout({ children }: { children: ReactNode }) {
  return <F0Shell>{children}</F0Shell>;
}
