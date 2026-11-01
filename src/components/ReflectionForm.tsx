"use client";

import { useActionState } from "react";
import { reflectionAction } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { input, label } from "./ui";

function Scale({ name, low, high }: { name: string; low: string; high: string }) {
  return (
    <div>
      <div className="mt-2 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-600 has-[:checked]:text-white"
          >
            <input type="radio" name={name} value={n} required className="sr-only" />
            {n}
          </label>
        ))}
      </div>
      <div className="mt-1 flex w-[13.5rem] justify-between text-xs text-slate-500">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export function ReflectionForm({ challengeId }: { challengeId: string }) {
  const [state, action] = useActionState(reflectionAction, undefined);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="challengeId" value={challengeId} />

      <fieldset>
        <legend className={label}>Did you do this step?</legend>
        <div className="mt-2 flex gap-3">
          {[
            ["yes", "Yes, I did it"],
            ["no", "I tried / didn't manage"],
          ].map(([v, t]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="radio" name="completed" value={v} required /> {t}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>How well did it go?</legend>
        <Scale name="selfRating" low="Poorly" high="Very well" />
      </fieldset>

      <fieldset>
        <legend className={label}>How difficult did it feel?</legend>
        <Scale name="perceivedDifficulty" low="Very easy" high="Very hard" />
      </fieldset>

      <div>
        <label className={label} htmlFor="whatHappened">What happened? Be specific.</label>
        <textarea id="whatHappened" name="whatHappened" rows={4} required minLength={10} className={input}
          placeholder="Who was involved, what you said or did, how they reacted…" />
      </div>
      <div>
        <label className={label} htmlFor="whatWasHard">What was hard, or what stopped you?</label>
        <textarea id="whatWasHard" name="whatWasHard" rows={2} className={input} />
      </div>
      <div>
        <label className={label} htmlFor="whatLearned">What will you do differently next time?</label>
        <textarea id="whatLearned" name="whatLearned" rows={2} className={input} />
      </div>

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <SubmitButton pendingText="Finding your pain points…">Send feedback</SubmitButton>
    </form>
  );
}
