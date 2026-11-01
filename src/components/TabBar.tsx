"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Today", match: ["/dashboard", "/challenge"], icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/mentor", label: "Mentor", match: ["/mentor"], icon: "M4 5h16v11H8l-4 4V5z" },
  { href: "/progress", label: "Progress", match: ["/progress"], icon: "M4 20V10m6 10V4m6 16v-7m4 7H2" },
  { href: "/me", label: "Me", match: ["/me"], icon: "M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = t.match.some((m) => path === m || path.startsWith(m + "/"));
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active ? "text-brand-600" : "text-slate-400"}`}
              >
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
