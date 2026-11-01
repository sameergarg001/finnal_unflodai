/** Full-screen, app-style auth layout: logo, one line, the form. Nothing else. */
export function AuthScreen({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-white px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mb-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-3xl font-bold text-white">U</div>
        <h1 className="mt-4 text-2xl font-bold">UnfoldAI</h1>
        <p className="mt-1 text-slate-500">{subtitle}</p>
      </div>
      {children}
    </main>
  );
}
