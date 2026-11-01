"use client";

import { useActionState } from "react";
import type { FormState } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { Notice, input, label } from "./ui";

export interface ProfileValues {
  name: string;
  age: number | null;
  profession: string;
  goal: string;
  about: string;
}

/** Profile fields — used in onboarding (with Skip) and on the Profile screen. */
export function ProfileForm({
  action,
  values,
  submitText,
  allowSkip,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  values: ProfileValues;
  submitText: string;
  allowSkip?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={label} htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={values.name} autoComplete="name" className={input} placeholder="Your name" />
      </div>
      <div className="grid grid-cols-[96px_1fr] gap-3">
        <div>
          <label className={label} htmlFor="age">Age</label>
          <input id="age" name="age" type="number" inputMode="numeric" min={10} max={120} defaultValue={values.age ?? ""} className={input} placeholder="—" />
        </div>
        <div>
          <label className={label} htmlFor="profession">Profession</label>
          <input id="profession" name="profession" defaultValue={values.profession} className={input} placeholder="Student, designer…" />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="goal">Main development goal</label>
        <textarea id="goal" name="goal" rows={2} defaultValue={values.goal} className={`${input} resize-none`} placeholder="e.g. Feel confident meeting new people" />
      </div>
      <div>
        <label className={label} htmlFor="about">About you <span className="text-muted/70">(optional)</span></label>
        <textarea id="about" name="about" rows={3} defaultValue={values.about} className={`${input} resize-none`} placeholder="Anything your mentor should know" />
      </div>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">✓ {state.ok}</Notice>}
      <div className="space-y-2 pt-2">
        <SubmitButton name="skip" value="0" pendingText="Saving…">{submitText}</SubmitButton>
        {allowSkip && (
          <button type="submit" name="skip" value="1" formNoValidate className="w-full py-3 text-sm font-medium text-muted">
            Skip for now — I&apos;ll add this later
          </button>
        )}
      </div>
    </form>
  );
}
