import Link from "next/link";
import { Icon, Logo, iconBtn } from "./ui";

/** Full-screen, app-style auth layout. */
export function AuthScreen({ title, subtitle, children, back, hero }: { title: string; subtitle?: string; children: React.ReactNode; back?: string; hero?: React.ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      {back && (
        <Link href={back} aria-label="Back" className={`${iconBtn} absolute left-4 top-[max(1rem,env(safe-area-inset-top))]`}>
          <Icon name="back" />
        </Link>
      )}
      <div className="relative animate-enter">
        <div className="mb-8 flex flex-col items-center text-center">
          {hero ?? <Logo size={64} />}
          <h1 className="mt-6 text-[30px] font-extrabold leading-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
