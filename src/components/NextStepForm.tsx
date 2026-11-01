"use client";

import { useActionState } from "react";
import { nextStepAction } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { input } from "./ui";

export function NextStepForm({ previousId }: { previousId: string }) {
  const [state, action] = useActionState(nextStepAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="previousId" value={previousId} />
      <details className="text-sm">
        <summary className="cursor-pointer list-none text-slate-400 [&::-webkit-details-marker]:hidden">+ Anything changed? (optional)</summary>
        <textarea name="update" rows={2} className={`${input} resize-none`} placeholder="e.g. The meeting moved to Wednesday." />
      </details>
      {state?.error && <p className="px-1 text-sm text-red-600">{state.error}</p>}
      <SubmitButton pendingText="Your mentor is thinking…">Next step →</SubmitButton>
    </form>
  );
}
