// src/components/neon/NeonTabBar.tsx
import * as React from "react";
import Link from "next/link";

export interface NeonTab {
  key: string;
  label: string;
  href: string;
}

export interface NeonTabBarProps {
  tabs: NeonTab[];
  activeKey: string;
  className?: string;
}

export const NeonTabBar: React.FC<NeonTabBarProps> = ({
  tabs,
  activeKey,
  className = "",
}) => {
  return (
    <nav className={`flex flex-wrap gap-2 text-xs sm:text-sm ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`rounded-full px-3 py-1.5 transition ${
              isActive
                ? "bg-gradient-to-r from-[#7F5CFF] to-[#5CA8FF] text-white shadow-[0_0_18px_rgba(127,92,255,0.7)]"
                : "border border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
};
