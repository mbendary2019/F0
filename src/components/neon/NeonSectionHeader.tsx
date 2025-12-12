// src/components/neon/NeonSectionHeader.tsx
import * as React from "react";

export interface NeonSectionHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const NeonSectionHeader: React.FC<NeonSectionHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  actions,
  className = "",
  ...rest
}) => {
  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
      {...rest}
    >
      <div>
        {eyebrow && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {eyebrow}
          </p>
        )}
        <h2 className="text-base font-semibold text-slate-50 sm:text-lg">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-xs text-slate-400 sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
};
