"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { FormState } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { input, label } from "./ui";

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [timezone, setTimezone] = useState("UTC");
  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  return (
    <form action={formAction} className="space-y-4">
      {mode === "signup" && (
        <div>
          <label className={label} htmlFor="name">Name</label>
          <input id="name" name="name" required className={input} autoComplete="name" />
        </div>
      )}
      <div>
        <label className={label} htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className={input} autoComplete="email" />
      </div>
      <div>
        <label className={label} htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          className={input}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </div>
      <input type="hidden" name="timezone" value={timezone} />

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <SubmitButton pendingText={mode === "signup" ? "Creating account…" : "Logging in…"}>
        {mode === "signup" ? "Create account" : "Log in"}
      </SubmitButton>

      <p className="text-sm text-slate-600">
        {mode === "signup" ? (
          <>Already have an account? <Link href="/login" className="font-medium text-brand-600">Log in</Link></>
        ) : (
          <>New to UnfoldAI? <Link href="/signup" className="font-medium text-brand-600">Create an account</Link></>
        )}
      </p>
    </form>
  );
}
