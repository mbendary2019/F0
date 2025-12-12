// src/components/neon/NeonBadge.tsx
import * as React from "react";

export type NeonBadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export interface NeonBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: NeonBadgeTone;
  pill?: boolean;
}

export const NeonBadge: React.FC<NeonBadgeProps> = ({
  tone = "neutral",
  pill = true,
  className = "",
  children,
  ...rest
}) => {
  const base =
    "inline-flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide";

  const radius = pill ? "rounded-full" : "rounded-md";

  const toneClass: Record<NeonBadgeTone, string> = {
    neutral: "bg-white/8 text-slate-200",
    accent: "bg-[#141432] text-[#9FA7FF]",
    success: "bg-emerald-500/15 text-emerald-200",
    warning: "bg-amber-500/15 text-amber-200",
    danger: "bg-red-500/15 text-red-200",
  };

  return (
    <span
      className={`${base} ${radius} ${toneClass[tone]} px-2 py-0.5 ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
};
