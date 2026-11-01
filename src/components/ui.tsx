import Link from "next/link";

// Shared UI building blocks (design tokens live in app/globals.css).

/** Chart series colours — validated for colour-blind separation on dark & light surfaces. */
export const SERIES = { evidence: "#8B5CF6", self: "#1D9BD7" } as const;

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-card p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-1 pb-2 pt-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}

export const btnPrimary =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-accent to-accent-strong px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent/25 transition active:scale-[0.98] disabled:opacity-60";
export const btnSecondary =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-card-2 px-4 py-3.5 text-base font-semibold text-fg transition active:scale-[0.98] disabled:opacity-60";
export const btnGhost = "inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-muted active:bg-card-2";
export const input =
  "mt-1 block w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-base text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";
export const label = "block text-sm font-medium text-muted";

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? btnPrimary : btnSecondary}>
      {children}
    </Link>
  );
}

export function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "accent" | "success" | "warn" }) {
  const t = {
    default: "bg-card-2 text-muted",
    accent: "bg-accent/15 text-accent",
    success: "bg-success/15 text-success",
    warn: "bg-warn/15 text-warn",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${t}`}>{children}</span>;
}

export function Avatar({ name, image, size = 44 }: { name: string; image?: string | null; size?: number }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" width={size} height={size} referrerPolicy="no-referrer" className="rounded-full object-cover ring-2 ring-accent/40" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name.trim()[0] ?? "U").toUpperCase()}
    </div>
  );
}

export function Logo({ size = 56 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-[28%] bg-gradient-to-br from-accent to-accent-2 font-extrabold text-white shadow-xl shadow-accent/30"
      style={{ width: size, height: size, fontSize: size * 0.46 }}
    >
      U
    </div>
  );
}

/** Horizontal progress bar (0–100). */
export function ProgressBar({ value, color = SERIES.evidence, label: aria }: { value: number; color?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-card-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={aria}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Circular score (0–100) with the number in the middle. */
export function ScoreRing({ value, size = 96, stroke = 9, caption }: { value: number | null; size?: number; stroke?: number; caption?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ring)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums">{value == null ? "—" : Math.round(value)}</span>
        {caption && <span className="text-[10px] uppercase tracking-wide text-muted">{caption}</span>}
      </div>
    </div>
  );
}

/** Tiny trend line for skill cards. One series → no legend; hover shows values. */
export function Sparkline({ values, width = 72, height = 26 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-[11px] text-muted">no trend yet</span>;
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 2 - ((v - min) / (max - min || 1)) * (height - 4)]);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Trend: ${values.map(Math.round).join(", ")}`}>
      <title>{`Score history: ${values.map(Math.round).join(" → ")}`}</title>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={SERIES.evidence} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={SERIES.evidence} stroke="var(--card)" strokeWidth={2} />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-card-2 ${className}`} />;
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line px-6 py-8 text-center">
      <p className="text-3xl">{icon}</p>
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error"; children: React.ReactNode }) {
  const t = { info: "bg-accent-2/10 text-accent-2", success: "bg-success/10 text-success", error: "bg-danger/10 text-danger" }[tone];
  return <p className={`rounded-2xl px-4 py-3 text-sm ${t}`}>{children}</p>;
}

export const DIFFICULTY_NAMES = ["", "Gentle", "Easy", "Moderate", "Stretch", "Bold"];
