import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CircleNotch } from "@phosphor-icons/react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-2",
  danger: "bg-surface text-danger border border-line hover:bg-surface-2",
};

export function Button({
  variant = "primary",
  loading,
  children,
  className = "",
  size = "md",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "h-9 px-4 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-13 px-7 text-base" };
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[filter,background-color,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {loading && <CircleNotch size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-ink-3">{label}</span>
      <span className="tabular text-3xl font-semibold tracking-tight">{value}</span>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-ink-3">{hint}</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/25";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

export function Notice({
  tone = "info",
  children,
  icon,
}: {
  tone?: "info" | "warn" | "success";
  children: ReactNode;
  icon?: ReactNode;
}) {
  const tones = {
    info: "bg-surface-2 text-ink-2",
    warn: "bg-warn-soft text-warn",
    success: "bg-accent-soft text-accent",
  };
  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2",
    accent: "bg-accent-soft text-accent",
    warn: "bg-warn-soft text-warn",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
