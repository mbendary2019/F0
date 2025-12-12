// src/components/neon/NeonPageShell.tsx
import * as React from "react";
import Link from "next/link";

type Crumb = { label: string; href?: string };

export interface NeonPageShellProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  rightActions?: React.ReactNode;
  children: React.ReactNode;
}

export const NeonPageShell: React.FC<NeonPageShellProps> = ({
  title,
  subtitle,
  breadcrumbs,
  rightActions,
  children,
}) => {
  return (
    <main className="min-h-screen bg-[#030314] text-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {breadcrumbs.map((c, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span>/</span>}
                {c.href ? (
                  <Link
                    href={c.href}
                    className="hover:text-slate-200 max-w-[180px] truncate"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-slate-300 max-w-[180px] truncate">
                    {c.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {(title || rightActions) && (
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {title && (
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1 max-w-xl text-xs text-slate-400 sm:text-sm">
                  {subtitle}
                </p>
              )}
            </div>
            {rightActions && (
              <div className="flex flex-wrap items-center gap-2">
                {rightActions}
              </div>
            )}
          </div>
        )}

        {children}
      </div>
    </main>
  );
};
