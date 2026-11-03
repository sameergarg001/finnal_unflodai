"use client";

import { useActionState, useState } from "react";
import type { FormState } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { Notice, ScoreRing } from "./ui";

interface SkillItem {
  id: string;
  name: string;
  description: string;
  initial: number | null;
}

const PRESETS = [
  { label: "Beginner", value: 20 },
  { label: "Developing", value: 40 },
  { label: "Capable", value: 60 },
  { label: "Strong", value: 80 },
  { label: "Expert", value: 95 },
];

const band = (v: number) => (v < 25 ? "Just starting" : v < 45 ? "Developing" : v < 65 ? "Capable" : v < 85 ? "Strong" : "Excellent");

/** Self-assessment: one slider card per core skill (0–100). */
export function AssessmentForm({ skills, action, from }: { skills: SkillItem[]; action: (s: FormState, f: FormData) => Promise<FormState>; from?: string }) {
  const [state, formAction] = useActionState(action, undefined);
  const [values, setValues] = useState<Record<string, number>>(Object.fromEntries(skills.map((s) => [s.id, s.initial ?? 50])));
  const [touched, setTouched] = useState<Set<string>>(new Set(skills.filter((s) => s.initial != null).map((s) => s.id)));
  const remaining = skills.length - touched.size;
  const [hint, setHint] = useState("");

  return (
    <form
      action={formAction}
      className="space-y-3"
      onSubmit={(e) => {
        if (remaining > 0) {
          e.preventDefault();
          setHint(`Tap a level for ${skills.filter((s) => !touched.has(s.id)).map((s) => s.name).join(", ")}.`);
        }
      }}
    >
      {from && <input type="hidden" name="from" value={from} />}
      {skills.map((s, i) => {
        const v = values[s.id];
        return (
          <div key={s.id} data-skill-card className="glass rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted">{i + 1} of {skills.length}</p>
                <h3 className="text-xl font-bold">{s.name}</h3>
                <p className={`text-sm ${touched.has(s.id) ? "text-accent" : "text-muted"}`}>{touched.has(s.id) ? band(v) : "Tap a level"}</p>
              </div>
              <div className={touched.has(s.id) ? "" : "opacity-40"}>
                <ScoreRing value={v} size={68} stroke={7} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-1.5">
              {PRESETS.map((p) => {
                const on = touched.has(s.id) && band(v) === band(p.value);
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setValues({ ...values, [s.id]: p.value });
                      setTouched(new Set(touched).add(s.id));
                      setHint("");
                    }}
                    className={`min-h-11 rounded-full px-0.5 text-[10.5px] font-semibold leading-tight tracking-tight transition active:scale-95 ${on ? "bg-accent text-on-accent" : "bg-card-2 text-muted"}`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              name={`score:${s.id}`}
              value={v}
              aria-label={`${s.name} self-rating`}
              className="slider mt-4 w-full"
              style={{ ["--pct" as string]: `${v}%` }}
              onChange={(e) => {
                setValues({ ...values, [s.id]: Number(e.target.value) });
                setTouched(new Set(touched).add(s.id));
                setHint("");
              }}
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted"><span>0</span><span>100</span></div>
          </div>
        );
      })}
      {(hint || state?.error) && <Notice tone="error">{state?.error ?? hint}</Notice>}
      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-bg via-bg to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <SubmitButton pendingText="Saving…">{remaining > 0 ? `Complete Assessment (${remaining} left to rate)` : "Complete Assessment"}</SubmitButton>
      </div>
    </form>
  );
}
