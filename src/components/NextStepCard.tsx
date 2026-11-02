import Link from "next/link";
import type { NextStep } from "@/server/services/nextStep";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";
import { btnPrimary, btnSecondary } from "./ui";
import { nextChallengeAction, startCoachAction } from "../../app/actions";

/** The home screen's main call to action: always one clear next step. */
export function NextStepCard({ step }: { step: NextStep }) {
  return (
    <div className="rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/20 via-card to-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">👉 Your next step</p>
      {step.kind === "feedback" && (
        <>
          <p className="mt-2 text-lg font-bold leading-snug">{step.title}</p>
          <p className="mt-1 text-sm text-muted">{step.skill} · tried it?</p>
          <div className="mt-4 grid grid-cols-[2fr_1fr] gap-2">
            <Link href={`/challenge/${step.challengeId}?feedback=1`} className={btnPrimary}>✓ I tried it</Link>
            <Link href={`/challenge/${step.challengeId}`} className={btnSecondary}>View</Link>
          </div>
          {step.extraActive > 0 && <p className="mt-3 text-xs text-muted">+{step.extraActive} more active challenge{step.extraActive === 1 ? "" : "s"} below</p>}
        </>
      )}
      {step.kind === "continue" && (
        <>
          <p className="mt-2 text-lg font-bold leading-snug">{step.emoji} Continue with {step.teacher}</p>
          <p className="mt-1 text-sm text-muted">{step.skill}</p>
          <div className="mt-4"><Link href={`/coach/${step.conversationId}`} className={btnPrimary}>Continue →</Link></div>
        </>
      )}
      {step.kind === "next" && (
        <>
          <p className="mt-2 text-lg font-bold leading-snug">Ready for your next {step.skill} task?</p>
          <ActionForm action={nextChallengeAction} className="mt-4">
            <input type="hidden" name="challengeId" value={step.challengeId} />
            <SubmitButton pendingText="Designing your task…">🎯 Get my next task</SubmitButton>
          </ActionForm>
        </>
      )}
      {step.kind === "start" && (
        <>
          <p className="mt-2 text-lg font-bold leading-snug">{step.emoji} Start {step.skill} with {step.teacher}</p>
          <ActionForm action={startCoachAction} className="mt-4">
            <input type="hidden" name="skillId" value={step.skillId} />
            <input type="hidden" name="fresh" value="1" />
            <SubmitButton pendingText="Opening your coach…">✨ Start in 1 tap</SubmitButton>
          </ActionForm>
        </>
      )}
    </div>
  );
}
