import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth/session";
import { TabBar } from "./TabBar";

/** Mobile app frame: compact top bar, scrolling content, bottom tab bar. */
export async function AppShell({
  title,
  back,
  right,
  children,
  tabs = true,
  header,
}: {
  title?: string;
  back?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  tabs?: boolean;
  /** Custom header content (replaces the title bar). */
  header?: React.ReactNode;
}) {
  const user = tabs ? await getCurrentUser() : null;
  const taskCount = user ? await db.challenge.count({ where: { userId: user.id, status: "active" } }) : 0;
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-bg">
      <header className="sticky top-0 z-10 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        {header ?? (
          <div className="flex h-14 items-center gap-2 px-4">
            {back && (
              <Link href={back} aria-label="Back" className="-ml-2 rounded-full p-2 text-muted active:bg-card-2">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Link>
            )}
            <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
            {right}
          </div>
        )}
      </header>
      <main className={`animate-enter space-y-4 px-4 pt-2 ${tabs ? "pb-28" : "pb-10"}`}>{children}</main>
      {tabs && <TabBar taskCount={taskCount} />}
    </div>
  );
}

/** Collapsed-by-default section — optional things live here, never forced. */
export function More({ label, children, open }: { label: React.ReactNode; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-3xl border border-line bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 py-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
        {label}
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
