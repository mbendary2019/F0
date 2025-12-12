// src/components/neon/NeonAppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NeonAppShellProps = {
  locale: string;
  children: ReactNode;
};

type NavItem = {
  label: string;
  href: (locale: string) => string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: (l) => `/${l}/f0` },
  { label: "Projects", href: (l) => `/${l}/projects` },
  { label: "Integrations", href: (l) => `/${l}/integrations` },
  { label: "Billing", href: (l) => `/${l}/billing` },
  { label: "Settings", href: (l) => `/${l}/settings` },
];

export function NeonAppShell({ locale, children }: NeonAppShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#030314] text-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-60 flex-col border-r border-white/10 bg-[#020212] md:flex">
        {/* Logo + عنوان */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#7F5CFF] to-[#5CA8FF] shadow-[0_0_18px_rgba(127,92,255,0.7)]">
            <span className="text-sm font-bold">F0</span>
          </div>
          <div className="leading-tight">
            <p className="text-xs font-semibold text-slate-100">From Zero</p>
            <p className="text-[10px] text-slate-400">AI Dev Platform</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4 text-xs">
          {navItems.map((item) => {
            const href = item.href(locale);
            const isActive = pathname === href || pathname?.startsWith(href + "/");

            return (
              <Link
                key={item.label}
                href={href}
                className={[
                  "flex items-center justify-between rounded-xl px-3 py-2 transition",
                  isActive
                    ? "bg-gradient-to-r from-[#7F5CFF]/70 to-[#5CA8FF]/70 text-white shadow-[0_0_20px_rgba(127,92,255,0.7)]"
                    : "text-slate-300 hover:bg-white/5 hover:text-slate-50",
                ].join(" ")}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer صغير */}
        <div className="border-t border-white/10 px-4 py-3 text-[10px] text-slate-500">
          Env: <span className="text-emerald-300">auto</span> • Phase 82
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-white/10 bg-[#050519] px-4 py-2 text-[11px] text-slate-300">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
              Logged in
            </span>
            <span className="hidden text-slate-500 sm:inline">
              Agent-ready workspace • Emulator / Cloud
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}`}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 hover:bg-white/10"
            >
              Public landing
            </Link>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-auto bg-[#030314]">
          {children}
        </main>
      </div>
    </div>
  );
}
