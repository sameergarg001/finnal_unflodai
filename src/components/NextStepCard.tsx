import Link from "next/link";
import type { NextStep } from "@/server/services/nextStep";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { Icon, TeacherAvatar, btnPrimary } from "./ui";
import { nextChallengeAction, startCoachAction } from "../../app/actions";

/** The home screen's main call to action: always one clear next step. */
export function NextStepCard({ step }: { step: NextStep }) {
  const copy = copyFor(step);

  return (
    <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-accent-soft via-accent-soft to-sun-soft p-5 shadow-soft">
      <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/40 blur-2xl dark:bg-white/5" />
      <div className="relative flex items-center gap-4">
        <TeacherAvatar emoji={step.emoji} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-accent">{copy.kicker}</p>
          <p className="font-display text-xl font-bold leading-tight">{copy.title}</p>
          {copy.meta && <p className="mt-1 truncate text-sm text-muted">{copy.meta}</p>}
        </div>
      </div>

      <div className="relative mt-4">
        {step.kind === "feedback" && (
          <div className="flex gap-2">
            <Link href={`/challenge/${step.challengeId}?feedback=1`} className={`${btnPrimary} flex-1`}>
              <Icon name="check" /> I tried it
            </Link>
            <Link href={`/challenge/${step.challengeId}`} aria-label="View task" className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-card-solid text-fg active:scale-95">
              <Icon name="chevron" />
            </Link>
          </div>
        )}
        {step.kind === "continue" && (
          <Link href={`/coach/${step.conversationId}`} className={btnPrimary}>
            <Icon name="chat" /> Continue
          </Link>
        )}
        {step.kind === "next" && (
          <ActionForm action={nextChallengeAction}>
            <input type="hidden" name="challengeId" value={step.challengeId} />
            <SubmitButton pendingText="Designing your task…"><Icon name="target" /> Get my next task</SubmitButton>
          </ActionForm>
        )}
        {step.kind === "start" && (
          <ActionForm action={startCoachAction}>
            <input type="hidden" name="skillId" value={step.skillId} />
            <input type="hidden" name="fresh" value="1" />
            <SubmitButton pendingText="Opening your coach…"><Icon name="spark" /> Start in 1 tap</SubmitButton>
          </ActionForm>
        )}
        {step.kind === "feedback" && step.extraActive > 0 && (
          <Link href="/tasks" className="mt-2.5 block text-center text-xs font-medium text-muted">+{step.extraActive} more waiting</Link>
        )}
      </div>
    </div>
  );
}

function copyFor(step: NextStep): { kicker: string; title: string; meta?: string } {
  if (step.kind === "feedback") return { kicker: `${step.teacher} is waiting`, title: "How did it go?", meta: step.title };
  if (step.kind === "continue") return { kicker: step.skill, title: `Continue with ${step.teacher}` };
  if (step.kind === "next") return { kicker: `${step.teacher} · ${step.skill}`, title: "Ready for the next one?" };
  return { kicker: `With ${step.teacher}`, title: `Start ${step.skill}`, meta: "3 quick questions, then a small task" };
}
