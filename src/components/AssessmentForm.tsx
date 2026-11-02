"use client";

import { useActionState, useState } from "react";
import type { FormState } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { Notice } from "./ui";

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
          <div key={s.id} className="rounded-3xl border border-line bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted">{i + 1} / {skills.length}</p>
                <h3 className="text-lg font-bold">{s.name}</h3>
              </div>
              <div className="text-right">
                <p className={`text-3xl font-bold tabular-nums ${touched.has(s.id) ? "" : "text-muted"}`}>{v}</p>
                <p className="text-[11px] text-muted">{band(v)}</p>
              </div>
            </div>
            <p className="mt-1 text-sm text-muted">{s.description}</p>
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
                    className={`min-h-11 rounded-xl px-0.5 text-[10px] font-semibold leading-tight tracking-tight transition active:scale-95 ${on ? "bg-accent text-white" : "bg-card-2 text-muted"}`}
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
            <div className="mt-1 flex justify-between text-[11px] text-muted"><span>0</span><span>fine-tune with the slider</span><span>100</span></div>
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
