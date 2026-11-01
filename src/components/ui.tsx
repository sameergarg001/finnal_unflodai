import { levelForScore } from "@/server/assessment/levels";
import Link from "next/link";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
    </div>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? btnPrimary : btnSecondary}>
      {children}
    </Link>
  );
}

export const btnPrimary =
  "inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white active:bg-brand-700 disabled:opacity-60";
export const btnSecondary =
  "inline-flex w-full items-center justify-center rounded-xl bg-slate-100 px-4 py-3.5 text-base font-semibold text-slate-700 active:bg-slate-200";
export const input =
  "mt-1 block w-full rounded-xl border-0 bg-slate-100 px-4 py-3.5 text-base placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500";
export const label = "block text-sm font-medium text-slate-700";

export function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct < 35 ? "bg-amber-400" : pct < 65 ? "bg-brand-500" : "bg-emerald-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function levelName(score: number): string {
  return levelForScore(score).name;
}

/** Tiny dependency-free line chart. */
export function Sparkline({ values, width = 160, height = 40 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-xs text-slate-400">Not enough data yet</span>;
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / (max - min || 1)) * height}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-500" />
    </svg>
  );
}
