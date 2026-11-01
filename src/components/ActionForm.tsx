"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "../../app/actions";
import { Notice } from "./ui";

/** A form bound to a server action that returns FormState; shows errors/success inline. */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess,
  confirm,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  /** Ask for confirmation before submitting. */
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && <div className="mt-3"><Notice tone="error">{state.error}</Notice></div>}
      {state?.ok && state.ok !== "sent" && state.ok !== "done" && <div className="mt-3"><Notice tone="success">✓ {state.ok}</Notice></div>}
    </form>
  );
}
