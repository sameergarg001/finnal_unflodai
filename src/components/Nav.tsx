import Link from "next/link";
import { logoutAction } from "../../app/actions";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/progress", label: "Progress" },
  { href: "/skills", label: "My skills" },
];

export function Nav({ name }: { name?: string | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/dashboard" className="font-bold text-brand-700">
          UnfoldAI
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-slate-600 hover:text-slate-900">
              {l.label}
            </Link>
          ))}
          <form action={logoutAction}>
            <button className="text-slate-500 hover:text-slate-900" title={name ?? undefined}>
              Log out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
