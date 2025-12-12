// src/components/neon/NeonInput.tsx
import * as React from "react";

export interface NeonInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const NeonInput = React.forwardRef<HTMLInputElement, NeonInputProps>(
  (
    {
      label,
      description,
      error,
      prefix,
      suffix,
      className = "",
      id,
      ...rest
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 8)}`;

    return (
      <div className="space-y-1 text-xs sm:text-sm">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[11px] font-medium text-slate-200"
          >
            {label}
          </label>
        )}

        <div
          className={`flex items-center rounded-xl border bg-[#050519] text-xs text-slate-100 transition focus-within:border-[#5CA8FF] focus-within:shadow-[0_0_18px_rgba(92,168,255,0.5)] ${
            error ? "border-red-500/70" : "border-white/10"
          } ${className}`}
        >
          {prefix && (
            <div className="flex items-center px-2 text-slate-400">
              {prefix}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className="h-9 w-full bg-transparent px-2 py-1 text-xs text-slate-100 outline-none placeholder:text-slate-500"
            {...rest}
          />
          {suffix && (
            <div className="flex items-center px-2 text-slate-400">
              {suffix}
            </div>
          )}
        </div>

        {description && !error && (
          <p className="text-[11px] text-slate-500">{description}</p>
        )}
        {error && (
          <p className="text-[11px] text-red-300 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            {error}
          </p>
        )}
      </div>
    );
  }
);

NeonInput.displayName = "NeonInput";
