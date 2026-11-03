import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth/session";
import { TabBar } from "./TabBar";
import { Icon, iconBtn } from "./ui";

/** Mobile app frame: compact top bar, scrolling content, floating tab dock. */
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
    <div className="mx-auto min-h-dvh max-w-md md:max-w-xl">
      <header className="sticky top-0 z-10 bg-gradient-to-b from-bg via-bg/90 to-bg/0 pt-[env(safe-area-inset-top)]">
        {header ?? (
          <div className="flex h-16 items-center gap-3 px-4">
            {back && (
              <Link href={back} aria-label="Back" className={iconBtn}>
                <Icon name="back" />
              </Link>
            )}
            <h1 className={`flex-1 truncate font-bold ${back ? "text-lg" : "text-[26px]"}`}>{title}</h1>
            {right}
          </div>
        )}
      </header>
      <main className={`animate-enter space-y-3 px-4 pt-1 ${tabs ? "pb-32" : "pb-10"}`}>{children}</main>
      {tabs && <TabBar taskCount={taskCount} />}
    </div>
  );
}

/** Collapsed-by-default section — optional things live here, never forced. */
export function More({ label, children, open }: { label: React.ReactNode; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="glass group rounded-[24px]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
        {label}
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card-2 text-muted transition group-open:rotate-90">
          <Icon name="chevron" className="h-4 w-4" />
        </span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
