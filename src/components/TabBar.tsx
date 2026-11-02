"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Home", match: ["/dashboard", "/skills", "/notifications", "/mentor"], icon: "M3 11.5l9-7.5 9 7.5M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5" },
  { href: "/tasks", label: "Tasks", match: ["/tasks", "/challenge", "/coach"], icon: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" },
  { href: "/reports", label: "Reports", match: ["/reports"], icon: "M4 20V11m5.5 9V5m5.5 15v-6.5M20.5 20V9" },
  { href: "/profile", label: "Profile", match: ["/profile"], icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7.5 8.5a7.5 7.5 0 0115 0" },
];

export function TabBar({ taskCount = 0 }: { taskCount?: number }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = t.match.some((m) => path === m || path.startsWith(m + "/"));
          return (
            <li key={t.href} className="flex-1">
              <Link href={t.href} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${active ? "text-accent" : "text-muted"}`}>
                {t.href === "/tasks" && taskCount > 0 && (
                  <span className="absolute left-1/2 top-1 ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-2 px-1 text-[10px] font-bold text-bg" aria-label={`${taskCount} waiting`}>
                    {taskCount}
                  </span>
                )}
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d={t.icon} />
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
