"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Home", match: ["/dashboard", "/skills", "/challenge", "/coach", "/notifications"], icon: "M3 11.5l9-7.5 9 7.5M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5" },
  { href: "/mentor", label: "Coach", match: ["/mentor"], icon: "M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H9l-5 4V6.5z" },
  { href: "/reports", label: "Reports", match: ["/reports"], icon: "M4 20V11m5.5 9V5m5.5 15v-6.5M20.5 20V9" },
  { href: "/profile", label: "Profile", match: ["/profile"], icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7.5 8.5a7.5 7.5 0 0115 0" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = t.match.some((m) => path === m || path.startsWith(m + "/"));
          return (
            <li key={t.href} className="flex-1">
              <Link href={t.href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${active ? "text-accent" : "text-muted"}`}>
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
