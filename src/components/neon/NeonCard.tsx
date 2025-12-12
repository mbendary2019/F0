// src/components/neon/NeonCard.tsx
import * as React from "react";

export interface NeonCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  tone?: "default" | "accent" | "warning" | "success";
}

export const NeonCard: React.FC<NeonCardProps> = ({
  title,
  subtitle,
  badge,
  icon,
  footer,
  tone = "default",
  className = "",
  children,
  ...rest
}) => {
  const base =
    "relative overflow-hidden rounded-2xl border bg-[#090921] p-4 text-sm text-slate-200";

  const toneBorder: Record<NeonCardProps["tone"], string> = {
    default: "border-white/8",
    accent: "border-[#7F5CFF]/50 shadow-[0_0_26px_rgba(127,92,255,0.5)]",
    warning: "border-amber-400/50 shadow-[0_0_26px_rgba(251,191,36,0.4)]",
    success: "border-emerald-400/50 shadow-[0_0_26px_rgba(16,185,129,0.4)]",
  };

  return (
    <div className={`${base} ${toneBorder[tone]} ${className}`} {...rest}>
      <div className="absolute inset-x-0 -top-24 h-32 bg-gradient-to-b from-white/10 via-transparent to-transparent opacity-0 blur-3xl transition group-hover:opacity-100" />

      {(badge || icon || title) && (
        <div className="relative mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-slate-100">
                {icon}
              </div>
            )}
            {title && (
              <div>
                <div className="text-xs font-semibold text-slate-50">
                  {title}
                </div>
                {subtitle && (
                  <div className="text-[11px] text-slate-400">
                    {subtitle}
                  </div>
                )}
              </div>
            )}
          </div>
          {badge && (
            <span className="rounded-full bg-[#141432] px-2 py-0.5 text-[10px] font-medium text-[#9FA7FF]">
              {badge}
            </span>
          )}
        </div>
      )}

      <div className="relative text-xs sm:text-sm">{children}</div>

      {footer && (
        <div className="relative mt-3 border-t border-white/10 pt-3 text-xs text-slate-400">
          {footer}
        </div>
      )}
    </div>
  );
};
