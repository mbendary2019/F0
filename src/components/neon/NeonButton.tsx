// src/components/neon/NeonButton.tsx
import * as React from "react";

type NeonButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type NeonButtonSize = "sm" | "md" | "lg";

export interface NeonButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NeonButtonVariant;
  size?: NeonButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const NeonButton: React.FC<NeonButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  className = "",
  children,
  disabled,
  ...rest
}) => {
  const base =
    "inline-flex items-center justify-center rounded-full font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030314] focus-visible:ring-[#5CA8FF] disabled:opacity-60 disabled:cursor-not-allowed";

  const variantClass: Record<NeonButtonVariant, string> = {
    primary:
      "bg-gradient-to-r from-[#7F5CFF] to-[#5CA8FF] text-white shadow-[0_0_24px_rgba(127,92,255,0.8)] hover:brightness-110 border border-transparent",
    secondary:
      "bg-white/5 text-slate-100 border border-white/10 hover:bg-white/10 hover:border-white/25",
    outline:
      "bg-transparent text-slate-100 border border-white/25 hover:border-white/50 hover:bg-white/5",
    ghost:
      "bg-transparent text-slate-300 hover:bg-white/5 hover:text-slate-50 border border-transparent",
  };

  const sizeClass: Record<NeonButtonSize, string> = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-sm md:text-base px-5 py-2.5",
  };

  return (
    <button
      className={`${base} ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-transparent" />
      )}
      {leftIcon && <span className="mr-2">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};
