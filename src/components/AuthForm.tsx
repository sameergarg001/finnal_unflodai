"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { FormState } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { input } from "./ui";

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [timezone, setTimezone] = useState("");
  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  const signup = mode === "signup";

  return (
    <form action={formAction} className="space-y-3">
      <input name="email" type="email" required placeholder="Email" aria-label="Email" className={input} autoComplete="email" />
      <input
        name="password"
        type="password"
        required
        minLength={signup ? 8 : undefined}
        placeholder={signup ? "Password (8+ characters)" : "Password"}
        aria-label="Password"
        className={input}
        autoComplete={signup ? "new-password" : "current-password"}
      />
      <input type="hidden" name="timezone" value={timezone} />

      {state?.error && <p className="px-1 text-sm text-danger">{state.error}</p>}

      <div className="pt-2">
        <SubmitButton pendingText={signup ? "Creating…" : "Signing in…"}>{signup ? "Create account" : "Sign in"}</SubmitButton>
      </div>

      <p className="pt-4 text-center text-sm text-muted">
        {signup ? "Have an account? " : "New here? "}
        <Link href={signup ? "/login" : "/signup"} className="font-semibold text-accent">
          {signup ? "Log in" : "Create account"}
        </Link>
      </p>
    </form>
  );
}
