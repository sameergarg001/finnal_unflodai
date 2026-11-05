"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Home", match: ["/dashboard", "/skills", "/notifications", "/mentor"], icon: "M3 11.5l9-7.5 9 7.5M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5" },
  { href: "/tasks", label: "Tasks", match: ["/tasks", "/challenge", "/coach"], icon: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" },
  { href: "/reports", label: "Reports", match: ["/reports"], icon: "M4 20V11m5.5 9V5m5.5 15v-6.5M20.5 20V9" },
  { href: "/profile", label: "Profile", match: ["/profile"], icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7.5 8.5a7.5 7.5 0 0115 0" },
];

/** Floating dock: the active tab grows into a labelled pill. */
export function TabBar({ taskCount = 0 }: { taskCount?: number }) {
  const path = usePathname();
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]" aria-label="Main">
      <ul className="glass pointer-events-auto mx-auto flex max-w-sm items-center justify-between gap-1 rounded-full p-1.5">
        {TABS.map((t) => {
          const active = t.match.some((m) => path === m || path.startsWith(m + "/"));
          return (
            <li key={t.href} className={active ? "flex-[1.6]" : "flex-1"}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                aria-label={t.label}
                className={`relative flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                  active ? "bg-accent text-on-accent shadow-[0_8px_20px_-10px_var(--accent)]" : "text-muted hover:text-fg"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round">
                  <path d={t.icon} />
                </svg>
                {active && <span>{t.label}</span>}
                {t.href === "/tasks" && taskCount > 0 && (
                  <span className={`${active ? "static ring-0" : "absolute right-[18%] top-1.5 ring-2"} flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sun px-1 text-[10px] font-bold text-on-sun ring-card-solid`} aria-label={`${taskCount} waiting`}>
                    {taskCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
