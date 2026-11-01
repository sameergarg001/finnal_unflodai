"use client";

import { useFormStatus } from "react-dom";
import { btnPrimary, btnSecondary } from "./ui";

export function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  name,
  value,
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary";
  name?: string;
  value?: string;
  className?: string;
}) {
  const { pending, data } = useFormStatus();
  // When several submit buttons share a form, only the one pressed shows progress.
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`${variant === "primary" ? btnPrimary : btnSecondary} ${className}`}>
      {mine ? (
        <>
          <Spinner /> {pendingText ?? "Saving…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}
