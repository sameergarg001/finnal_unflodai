import { DifficultyDots, Icon, type IconName } from "./ui";

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

/** Full task content (used in chat and on the task screen). */
export function ChallengeBody({ c, compact }: { c: ChallengeView; compact?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip><Icon name="clock" className="h-3.5 w-3.5" />{c.estimatedMinutes} min</Chip>
        <Chip><DifficultyDots value={c.difficulty} /></Chip>
        {c.subskillLabel && <Chip>{c.subskillLabel}</Chip>}
      </div>
      <h3 className="text-[22px] font-bold leading-tight">{c.title}</h3>
      {(c.objective || c.struggle) && (
        <div className="space-y-2">
          {c.objective && <Row icon="target">{c.objective}</Row>}
          {c.struggle && <Row icon="flag">{c.struggle}</Row>}
        </div>
      )}
      <p className="text-[15px] leading-relaxed">{c.instructions}</p>
      {c.steps.length > 0 && (
        <ol className="space-y-2">
          {c.steps.map((s, i) => (
            <li key={i} className="flex gap-3 rounded-2xl bg-card-2/50 p-3 text-[15px] leading-snug">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {c.example && (
        <div className="relative rounded-[20px] rounded-bl-md bg-sun-soft p-4">
          <p className="text-xs font-semibold text-sun-ink">Try saying</p>
          <p className="mt-1 text-[15px] italic leading-relaxed">“{c.example}”</p>
        </div>
      )}
      {!compact && c.expectedOutcome && <Row icon="check" label="Done when">{c.expectedOutcome}</Row>}
      {!compact && c.feedbackInstructions && <Row icon="chat" label="Then tell your coach">{c.feedbackInstructions}</Row>}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-card-2/80 px-3 text-xs font-semibold text-muted">{children}</span>;
}

function Row({ icon, label, children }: { icon: IconName; label?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Icon name={icon} className="h-3.5 w-3.5" /></span>
      <div className="min-w-0 pt-0.5 text-[15px] leading-snug">
        {label && <p className="text-xs text-muted">{label}</p>}
        {children}
      </div>
    </div>
  );
}
