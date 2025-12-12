'use client';

import React from 'react';
import F0Shell from '@/components/f0/F0Shell';

export default function F0PageShell({ children }: { children: React.ReactNode }) {
  return <F0Shell>{children}</F0Shell>;
}
