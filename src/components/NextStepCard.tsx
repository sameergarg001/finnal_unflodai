import Link from "next/link";
import type { NextStep } from "@/server/services/nextStep";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { TeacherAvatar, btnPrimary, btnSecondary } from "./ui";
import { nextChallengeAction, startCoachAction } from "../../app/actions";

/** The home screen's main call to action: always one clear next step. */
export function NextStepCard({ step }: { step: NextStep }) {
  const teacher = "teacher" in step ? { name: step.teacher, emoji: step.emoji } : null;
  const copy = copyFor(step);

  return (
    <div className="overflow-hidden rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/25 via-card to-card p-5 shadow-lg shadow-accent/10">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">👉 Your next step</p>
      <div className="mt-3 flex items-start gap-3">
        {teacher && <TeacherAvatar emoji={teacher.emoji} size={44} />}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-snug">{copy.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.body}</p>
        </div>
      </div>
      {step.kind === "feedback" && (
        <>
          <div className="mt-4 grid grid-cols-[2fr_1fr] gap-2">
            <Link href={`/challenge/${step.challengeId}?feedback=1`} className={btnPrimary}>✓ I tried it</Link>
            <Link href={`/challenge/${step.challengeId}`} className={btnSecondary}>View</Link>
          </div>
          {step.extraActive > 0 && <p className="mt-3 text-xs text-muted">+{step.extraActive} more waiting in Tasks</p>}
        </>
      )}
      {step.kind === "continue" && (
        <div className="mt-4"><Link href={`/coach/${step.conversationId}`} className={btnPrimary}>Continue →</Link></div>
      )}
      {step.kind === "next" && (
        <ActionForm action={nextChallengeAction} className="mt-4">
          <input type="hidden" name="challengeId" value={step.challengeId} />
          <SubmitButton pendingText="Designing your task…">🎯 Get my next task</SubmitButton>
        </ActionForm>
      )}
      {step.kind === "start" && (
        <ActionForm action={startCoachAction} className="mt-4">
          <input type="hidden" name="skillId" value={step.skillId} />
          <input type="hidden" name="fresh" value="1" />
          <SubmitButton pendingText="Opening your coach…">✨ Start in 1 tap</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

function copyFor(step: NextStep): { title: string; body: string } {
  if (step.kind === "feedback") {
    return {
      title: `${step.teacher} wants to hear how it went`,
      body: `${step.title} · ${step.skill}. Say what actually happened. Rough is fine.`,
    };
  }
  if (step.kind === "continue") {
    return {
      title: `${step.emoji} Continue with ${step.teacher}`,
      body: `${step.skill} is still open. Pick up where you left off.`,
    };
  }
  if (step.kind === "next") {
    return {
      title: `Ready for your next ${step.skill} task?`,
      body: `${step.teacher} will keep it small. One task, then you're done for now.`,
    };
  }
  return {
    title: `${step.emoji} Start ${step.skill} with ${step.teacher}`,
    body: "Three quick questions, then a small task you can actually do today.",
  };
}
