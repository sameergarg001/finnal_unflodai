"use client";

import { useActionState, useState } from "react";
import { startSessionAction } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { input } from "./ui";

export interface SkillOption {
  id: string;
  name: string;
  category: string;
  levelName: string;
  levelValue: number;
}

/**
 * One question only: "What's going on today?". The skill is pre-picked
 * (mentor's suggestion) and can be changed from a small collapsed menu.
 */
export function StartSessionForm({ skills, suggestedId }: { skills: SkillOption[]; suggestedId: string | null }) {
  const [state, action] = useActionState(startSessionAction, undefined);
  const [skillId, setSkillId] = useState(suggestedId ?? skills[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const chosen = skills.find((s) => s.id === skillId);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="skillId" value={skillId} />
      <textarea
        name="situation"
        rows={4}
        required
        minLength={5}
        aria-label="What's going on today?"
        className={`${input} !mt-0 resize-none`}
        placeholder="What's going on today? e.g. I have a team meeting and I usually stay quiet."
      />

      <div className="text-sm">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-slate-500">
          Skill: <span className="font-semibold text-brand-700">{chosen?.name ?? "—"}</span>
          <svg viewBox="0 0 24 24" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSkillId(s.id);
                  setOpen(false);
                }}
                className={`rounded-full px-3 py-1.5 text-xs ${
                  s.id === skillId ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {state?.error && <p className="px-1 text-sm text-red-600">{state.error}</p>}
      <SubmitButton pendingText="Your mentor is thinking…">Get my step</SubmitButton>
    </form>
  );
}
