import Link from "next/link";

// Shared UI building blocks (design tokens live in app/globals.css).

/** Chart series colours — theme-aware (pine/mint vs amber/sun), colour-blind separable. */
export const SERIES = { evidence: "var(--series-evidence)", self: "var(--series-self)" } as const;

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass rounded-[28px] p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between px-1 pb-1 pt-4">
      <h2 className="text-[19px] font-bold">{children}</h2>
      {action}
    </div>
  );
}

export const btnPrimary =
  "inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-base font-semibold text-on-accent shadow-[0_10px_24px_-12px_var(--accent)] transition hover:bg-accent-strong active:scale-[0.98] disabled:opacity-60";
export const btnSecondary =
  "inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-card-2 px-5 py-3.5 text-base font-semibold text-fg transition hover:brightness-[0.97] active:scale-[0.98] disabled:opacity-60";
export const btnGhost = "inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-muted active:bg-card-2";
export const input =
  "mt-1 block w-full rounded-2xl border border-line bg-card-solid px-4 py-3.5 text-base text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";
export const label = "block text-sm font-medium text-muted";
/** Round icon button (header actions, back). */
export const iconBtn = "glass flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg transition active:scale-95";

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? btnPrimary : btnSecondary}>
      {children}
    </Link>
  );
}

export function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "accent" | "success" | "warn" | "sun" }) {
  const t = {
    default: "bg-card-2 text-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-success/15 text-success",
    warn: "bg-warn/15 text-warn",
    sun: "bg-sun-soft text-sun-ink",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${t}`}>{children}</span>;
}

export function Avatar({ name, image, size = 44 }: { name: string; image?: string | null; size?: number }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" width={size} height={size} referrerPolicy="no-referrer" className="rounded-full object-cover ring-2 ring-white/70" style={{ width: size, height: size }} />;
  }
  return (
    <div className="flex items-center justify-center rounded-full bg-sun font-display font-bold text-on-sun" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {(name.trim()[0] ?? "U").toUpperCase()}
    </div>
  );
}

/** Brand components live in ./Brand; re-exported so existing imports keep working. */
export { AppIcon, LogoMark, LogoLoader, Logo as LogoFull } from "./Brand";
/** Back-compat: `Logo` = the app icon at `size` px. */
export { AppIcon as Logo } from "./Brand";

/** Horizontal progress bar (0–100). */
export function ProgressBar({ value, color = SERIES.evidence, label: aria, thick }: { value: number; color?: string; label?: string; thick?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`${thick ? "h-2.5" : "h-1.5"} w-full overflow-hidden rounded-full bg-card-2`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={aria}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/** Circular score (0–100) with the number in the middle. */
export function ScoreRing({
  value,
  size = 96,
  stroke = 9,
  caption,
  color = "var(--accent)",
  marker,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  caption?: string;
  color?: string;
  /** Optional second value shown as a small dot on the ring (e.g. self-rating). */
  marker?: number | null;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  const m = marker == null ? null : (Math.max(0, Math.min(100, marker)) / 100) * 2 * Math.PI;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-2)" strokeWidth={stroke} />
        {value != null && (
          <circle
            className="ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ ["--c" as string]: c }}
          />
        )}
        {m != null && <circle cx={size / 2 + r * Math.cos(m)} cy={size / 2 + r * Math.sin(m)} r={stroke * 0.55} fill="var(--series-self)" stroke="var(--card-solid)" strokeWidth={2} />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold tabular-nums leading-none" style={{ fontSize: size * 0.3 }}>
          {value == null ? "—" : Math.round(value)}
        </span>
        {caption && <span className="mt-1 text-[11px] text-muted">{caption}</span>}
      </div>
    </div>
  );
}

/** Tiny trend line. One series → no legend; hover shows values. */
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
      <circle cx={last[0]} cy={last[1]} r={3} fill={SERIES.evidence} stroke="var(--card-solid)" strokeWidth={2} />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-card-2 ${className}`} />;
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="glass rounded-[28px] px-6 py-9 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-3xl">{icon}</span>
      <p className="mt-3 font-display text-lg font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-[17rem] text-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "error"; children: React.ReactNode }) {
  const t = { info: "bg-sun-soft text-sun-ink", success: "bg-accent-soft text-accent", error: "bg-danger/10 text-danger" }[tone];
  return <p className={`rounded-2xl px-4 py-3 text-sm font-medium ${t}`}>{children}</p>;
}

export const DIFFICULTY_NAMES = ["", "Gentle", "Easy", "Moderate", "Stretch", "Bold"];

/** Difficulty as five dots (1–5). */
export function DifficultyDots({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${DIFFICULTY_NAMES[value]} · ${value}/5`} aria-label={`Difficulty ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= value ? "bg-sun" : "bg-card-2"}`} />
      ))}
    </span>
  );
}

/** A skill teacher's avatar: emoji in a soft glassy orb. */
export function TeacherAvatar({ emoji, size = 40 }: { emoji: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white/90 to-accent-soft shadow-[inset_0_-3px_8px_rgba(107,63,224,0.18),0_6px_14px_-8px_rgba(22,26,61,0.4)] dark:from-white/10"
      style={{ width: size, height: size, fontSize: size * 0.48 }}
      aria-hidden
    >
      {emoji}
    </span>
  );
}

/** Small stroke icons used across the app (24×24, currentColor). */
const ICONS = {
  back: "M15 18l-6-6 6-6",
  chevron: "M9 6l6 6-6 6",
  bell: "M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 003.4 0",
  send: "M12 19V5M6 11l6-6 6 6",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7",
  clock: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z",
  chat: "M4 5h16v11H8l-4 4V5z",
  target: "M12 21a9 9 0 100-18 9 9 0 000 18zm0-4a5 5 0 100-10 5 5 0 000 10zm0-4a1 1 0 100-2 1 1 0 000 2z",
  flag: "M5 21V4m0 0h11l-2 4 2 4H5",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zm9 2l-3.5-3.5",
  refresh: "M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15m0 5v-5h5",
  mic: "M9 5a3 3 0 016 0v6a3 3 0 01-6 0V5zM5 11a7 7 0 0014 0M12 18v3",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  pencil: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 017 0v3",
  palette: "M12 3a9 9 0 100 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5s.7-1.5 1.7-1.5H17a4 4 0 004-4c0-4.7-4-8.5-9-8.5zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "h-5 w-5", strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}
