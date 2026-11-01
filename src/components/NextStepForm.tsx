"use client";

import { useActionState } from "react";
import { nextStepAction } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { input, label } from "./ui";

export function NextStepForm({ previousId }: { previousId: string }) {
  const [state, action] = useActionState(nextStepAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="previousId" value={previousId} />
      <div>
        <label className={label} htmlFor="update">Has anything changed in your situation? (optional)</label>
        <textarea id="update" name="update" rows={2} className={input} placeholder="e.g. The meeting moved to Wednesday, and my manager will be there." />
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <SubmitButton pendingText="Designing your next step…">Give me the next step →</SubmitButton>
    </form>
  );
}
