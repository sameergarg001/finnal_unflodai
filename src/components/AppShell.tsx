import Link from "next/link";
import { TabBar } from "./TabBar";

/** Mobile app frame: compact top bar, scrolling content, bottom tab bar. */
export function AppShell({
  title,
  back,
  right,
  children,
}: {
  title: string;
  back?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4">
          {back && (
            <Link href={back} aria-label="Back" className="-ml-2 rounded-full p-2 text-slate-500 active:bg-slate-200">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
          )}
          <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
          {right}
        </div>
      </header>
      <main className="space-y-4 px-4 pb-28 pt-4">{children}</main>
      <TabBar />
    </div>
  );
}

/** Collapsed-by-default section — optional things live here, never forced. */
export function More({ label, children, open }: { label: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden">
        {label}
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}
