"use client";

import { useActionState } from "react";
import { reflectionAction } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { input } from "./ui";

function Scale({ name, low, high }: { name: string; low: string; high: string }) {
  return (
    <div>
      <div className="flex justify-between gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="flex-1">
            <input type="radio" name={name} value={n} className="peer sr-only" />
            <span className="flex h-10 items-center justify-center rounded-xl bg-slate-100 text-sm peer-checked:bg-brand-600 peer-checked:text-white">
              {n}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/** Minimal check-in: Did it / Didn't + one text box. Ratings are optional, tucked away. */
export function ReflectionForm({ challengeId }: { challengeId: string }) {
  const [state, action] = useActionState(reflectionAction, undefined);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="challengeId" value={challengeId} />

      <div className="grid grid-cols-2 gap-2">
        {[
          ["yes", "✓ Did it"],
          ["no", "Didn't manage"],
        ].map(([v, t]) => (
          <label key={v}>
            <input type="radio" name="completed" value={v} required className="peer sr-only" />
            <span className="flex h-12 cursor-pointer items-center justify-center rounded-xl bg-slate-100 text-[15px] font-medium text-slate-600 peer-checked:bg-brand-600 peer-checked:text-white">
              {t}
            </span>
          </label>
        ))}
      </div>

      <textarea
        name="whatHappened"
        rows={4}
        required
        minLength={3}
        aria-label="How did it go?"
        className={`${input} resize-none`}
        placeholder="How did it go? What happened, what was hard?"
      />

      <details className="group text-sm">
        <summary className="cursor-pointer list-none text-slate-400 [&::-webkit-details-marker]:hidden">
          + More detail (optional)
        </summary>
        <div className="mt-3 space-y-4">
          <div>
            <p className="mb-2 text-slate-600">How well did it go?</p>
            <Scale name="selfRating" low="Poorly" high="Very well" />
          </div>
          <div>
            <p className="mb-2 text-slate-600">How hard did it feel?</p>
            <Scale name="perceivedDifficulty" low="Easy" high="Very hard" />
          </div>
          <textarea name="whatWasHard" rows={2} className={`${input} resize-none`} placeholder="What stopped you or felt hard?" />
          <textarea name="whatLearned" rows={2} className={`${input} resize-none`} placeholder="What will you do differently?" />
        </div>
      </details>

      {state?.error && <p className="px-1 text-sm text-red-600">{state.error}</p>}
      <SubmitButton pendingText="Sending…">Send to mentor</SubmitButton>
    </form>
  );
}
