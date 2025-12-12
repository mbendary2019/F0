'use client';

import { useParams } from 'next/navigation';
import F0Shell from '@/components/f0/F0Shell';

export default function WalletPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const isRTL = locale === 'ar';

  return (
    <F0Shell>
      <div className={`space-y-3 mb-4 ${isRTL ? 'text-right' : ''}`}>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
          F0 Panel · {locale === 'ar' ? 'محفظة FZ' : 'FZ Wallet'}
        </p>
        <h1 className="text-2xl font-semibold text-white">
          {locale === 'ar' ? 'محفظة FZ' : 'FZ Wallet'}
        </h1>
        <p className="text-sm text-slate-400">
          {locale === 'ar'
            ? 'نظرة عامة على رصيدك والمعاملات.'
            : 'Your tokens & transactions overview.'}
        </p>
      </div>

      <p className="text-sm text-slate-300">
        {locale === 'ar'
          ? 'رصيد FZ Token، السجل، والمدفوعات ستكون هنا.'
          : 'FZ Token balance, history, and payments will be here.'}
      </p>
    </F0Shell>
  );
}
