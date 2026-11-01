import { DIFFICULTY_NAMES, Pill } from "./ui";

export interface ChallengeView {
  id: string;
  title: string;
  struggle: string | null;
  objective: string | null;
  instructions: string;
  steps: string[];
  expectedOutcome: string | null;
  example: string | null;
  feedbackInstructions: string | null;
  difficulty: number;
  estimatedMinutes: number;
  subskillLabel: string | null;
  skillName: string;
  status: string;
}

/** Full challenge content (used in chat and on the challenge screen). */
export function ChallengeBody({ c, compact }: { c: ChallengeView; compact?: boolean }) {
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="accent">{c.skillName}{c.subskillLabel ? ` · ${c.subskillLabel}` : ""}</Pill>
        <Pill>{DIFFICULTY_NAMES[c.difficulty]} · {c.difficulty}/5</Pill>
        <Pill>~{c.estimatedMinutes} min</Pill>
      </div>
      <h3 className="text-xl font-bold leading-snug">{c.title}</h3>
      {c.struggle && <Field label="Your current difficulty">{c.struggle}</Field>}
      {c.objective && <Field label="Objective">{c.objective}</Field>}
      <p className="text-[15px] leading-relaxed">{c.instructions}</p>
      {c.steps.length > 0 && (
        <ol className="space-y-2">
          {c.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[15px]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {c.example && <div className="rounded-2xl bg-card-2 p-3.5 text-sm"><p className="text-xs font-semibold text-muted">💬 Try saying</p><p className="mt-1 italic">{c.example}</p></div>}
      {!compact && c.expectedOutcome && <Field label="Expected outcome">{c.expectedOutcome}</Field>}
      {!compact && c.feedbackInstructions && <Field label="When you report back">{c.feedbackInstructions}</Field>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-[15px]">{children}</p>
    </div>
  );
}
