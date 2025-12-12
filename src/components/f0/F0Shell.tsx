'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';

type F0ShellProps = {
  children: ReactNode;
};

const navSections = [
  {
    title: 'MAIN',
    items: [
      { label: 'Overview', href: (l: string) => `/${l}/f0` },
      { label: 'Projects', href: (l: string) => `/${l}/projects` },
      { label: 'Live Coding', href: (l: string) => `/${l}/live` },
      { label: 'Marketplace', href: (l: string) => `/${l}/marketplace` },
    ],
  },
  {
    title: 'ACCOUNT & BILLING',
    items: [
      { label: 'FZ Wallet', href: (l: string) => `/${l}/wallet` },
      { label: 'Billing & Plans', href: (l: string) => `/${l}/pricing` },
    ],
  },
  {
    title: 'TOOLS',
    items: [
      { label: 'AI Logs', href: (l: string) => `/${l}/tools/logs` },
      { label: 'Activity History', href: (l: string) => `/${l}/tools/activity` },
      { label: 'Deployments', href: (l: string) => `/${l}/deployments` },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'Settings', href: (l: string) => `/${l}/settings` },
      { label: 'Account', href: (l: string) => `/${l}/account` },
    ],
  },
];

export default function F0Shell({ children }: F0ShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const segments = pathname.split('/').filter(Boolean);
  const locale = segments[0] === 'ar' ? 'ar' : 'en';
  const isRTL = locale === 'ar';

  const switchLocale = (targetLocale: 'en' | 'ar') => {
    const segs = pathname.split('/').filter(Boolean);
    segs[0] = targetLocale;
    router.push('/' + segs.join('/'));
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push(`/${locale}/auth`);
  };

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div
      className={`f0-neon-shell h-screen max-h-screen flex overflow-hidden text-white relative ${
        isRTL ? 'rtl' : ''
      }`}
    >
      {/* SIDEBAR */}
      <aside className="hidden md:flex md:flex-col w-60 flex-shrink-0 border-r border-[#2c1466] bg-[#07001b]/80 backdrop-blur relative z-10">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 flex items-center justify-center text-sm font-bold">
              F0
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-violet-300">
                FROM ZERO
              </div>
              <div className="text-sm font-semibold text-white">F0 Panel</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {navSections.map((section) => (
            <div key={section.title}>
              <div className="px-2 mb-2 text-[10px] font-semibold tracking-[0.2em] text-violet-400/70">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const href = item.href(locale);
                  const active = isActive(href);
                  return (
                    <Link
                      key={item.label}
                      href={href}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition ${
                        active
                          ? 'bg-[#241155] text-white shadow-[0_0_0_1px_rgba(123,92,255,0.8)]'
                          : 'text-violet-200/80 hover:bg-[#1a0d3c] hover:text-white'
                      }`}
                    >
                      <span>{item.label}</span>
                      {active && (
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(244,114,182,0.9)]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-[#2c1466] text-[11px] text-violet-300/70">
          F0 • From Zero to Production
        </div>
      </aside>

      {/* MAIN COLUMN: HEADER + CONTENT */}
      <div className="flex flex-1 flex-col min-h-0 relative z-10">
        {/* HEADER */}
        <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 border-b border-[#2c1466] bg-[#050018]/90 backdrop-blur">
          <div className="text-xs font-medium text-violet-200/80">
            F0 Dashboard
          </div>

          <div className="flex items-center gap-3">
            {/* Language toggle */}
            <div className="inline-flex items-center rounded-full bg-[#12072c] p-1 text-xs">
              <button
                type="button"
                onClick={() => switchLocale('en')}
                className={`px-3 py-1 rounded-full transition ${
                  locale === 'en'
                    ? 'bg-[#7b5cff] text-white shadow-[0_0_0_1px_rgba(123,92,255,0.9)]'
                    : 'text-violet-200/80'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => switchLocale('ar')}
                className={`px-3 py-1 rounded-full transition ${
                  locale === 'ar'
                    ? 'bg-[#7b5cff] text-white shadow-[0_0_0_1px_rgba(123,92,255,0.9)]'
                    : 'text-violet-200/80'
                }`}
              >
                العربية
              </button>
            </div>

            {/* Email placeholder */}
            <span className="hidden md:inline text-xs text-violet-200/80">
              dev@test.com
            </span>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 shadow-lg shadow-fuchsia-500/30"
            >
              Logout
            </button>
          </div>
        </header>

        {/* CONTENT AREA: كل صفحات f0 هنا */}
        <main className="flex-1 min-h-0 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
