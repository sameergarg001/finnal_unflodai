"use client";

import { useActionState } from "react";
import { startSessionAction } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { input, label } from "./ui";

export interface SkillOption {
  id: string;
  name: string;
  category: string;
  levelName: string;
  levelValue: number;
}

export function StartSessionForm({ skills, suggestedId }: { skills: SkillOption[]; suggestedId: string | null }) {
  const [state, action] = useActionState(startSessionAction, undefined);
  const groups = [
    { title: "Core skills", items: skills.filter((s) => s.category === "core") },
    { title: "Your specific skills", items: skills.filter((s) => s.category === "specific") },
  ].filter((g) => g.items.length > 0);

  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="font-semibold">1. Which skill do you want to work on today?</legend>
        {groups.map((g) => (
          <div key={g.title} className="mt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{g.title}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {g.items.map((s) => (
                <label
                  key={s.id}
                  className="relative flex cursor-pointer flex-col rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
                >
                  <input type="radio" name="skillId" value={s.id} defaultChecked={s.id === suggestedId} required className="sr-only" />
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-xs text-slate-500">Lv {s.levelValue} · {s.levelName}</span>
                  {s.id === suggestedId && (
                    <span className="absolute right-2 top-2 rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">
                      Suggested
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <div>
        <label className={`${label} !text-base !font-semibold !text-slate-900`} htmlFor="situation">
          2. What's your current situation?
        </label>
        <p className="text-sm text-slate-500">
          Describe a real situation where you need this skill — what's happening, who's involved, what you find difficult.
        </p>
        <textarea
          id="situation"
          name="situation"
          rows={5}
          required
          minLength={15}
          className={input}
          placeholder="e.g. I have a weekly team meeting on Monday. I have ideas but I stay quiet because I'm afraid they'll sound stupid, and someone else usually says them first."
        />
      </div>

      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <SubmitButton pendingText="Creating your practical step…">Give me a practical step →</SubmitButton>
    </form>
  );
}
