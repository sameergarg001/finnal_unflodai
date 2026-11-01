import Link from "next/link";
import { Logo } from "./ui";

/** Full-screen, app-style auth layout. */
export function AuthScreen({ title, subtitle, children, back }: { title: string; subtitle?: string; children: React.ReactNode; back?: string }) {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center overflow-hidden px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />
      {back && (
        <Link href={back} aria-label="Back" className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full p-2 text-muted active:bg-card-2">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
      )}
      <div className="relative animate-enter">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={64} />
          <h1 className="mt-5 text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
