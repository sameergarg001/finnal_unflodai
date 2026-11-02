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
          <p className="mt-1 text-sm text-muted">{step.skill} challenge · tried it? Tell your coach how it went.</p>
          <div className="mt-4 grid grid-cols-[2fr_1fr] gap-2">
            <Link href={`/challenge/${step.challengeId}?feedback=1`} className={btnPrimary}>✓ I tried it</Link>
            <Link href={`/challenge/${step.challengeId}`} className={btnSecondary}>View</Link>
          </div>
          {step.extraActive > 0 && <p className="mt-3 text-xs text-muted">+{step.extraActive} more active challenge{step.extraActive === 1 ? "" : "s"} below</p>}
        </>
      )}
      {step.kind === "continue" && (
        <>
          <p className="mt-2 text-lg font-bold leading-snug">Continue with your {step.skill} coach</p>
          <p className="mt-1 text-sm text-muted">{step.proposedTitle ? `A challenge is waiting for your answer: “${step.proposedTitle}”` : "You were in the middle of a conversation."}</p>
          <div className="mt-4"><Link href={`/coach/${step.conversationId}`} className={btnPrimary}>Continue →</Link></div>
        </>
      )}
      {step.kind === "next" && (
        <>
          <p className="mt-2 text-lg font-bold leading-snug">Ready for your next {step.skill} challenge?</p>
          {step.nextFocus && <p className="mt-1 text-sm text-muted">Focus: {step.nextFocus}</p>}
          <ActionForm action={nextChallengeAction} className="mt-4">
            <input type="hidden" name="challengeId" value={step.challengeId} />
            <SubmitButton pendingText="Designing your challenge…">🎯 Get my next challenge</SubmitButton>
          </ActionForm>
        </>
      )}
      {step.kind === "start" && (
        <>
          <p className="mt-2 text-lg font-bold leading-snug">Start with {step.skill}</p>
          <p className="mt-1 text-sm text-muted">{step.reason}</p>
          <ActionForm action={startCoachAction} className="mt-4">
            <input type="hidden" name="skillId" value={step.skillId} />
            <input type="hidden" name="fresh" value="1" />
            <SubmitButton pendingText="Opening your coach…">✨ Start in 1 tap</SubmitButton>
          </ActionForm>
          <p className="mt-3 text-center text-xs text-muted">or pick any skill below</p>
        </>
      )}
    </div>
  );
}

/** Shown to new users until they accept their first challenge. */
export function HowItWorks() {
  const steps = [
    ["💬", "Tell your coach", "Pick a skill and say what's going on — 2–3 quick questions."],
    ["🎯", "Get one challenge", "A small, real-life task made for your situation."],
    ["📈", "Report back & grow", "Say how it went. Your coach analyses it and plans the next step."],
  ];
  return (
    <div className="rounded-3xl border border-line bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">How UnfoldAI works</p>
      <ol className="mt-3 space-y-3">
        {steps.map(([icon, title, body], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card-2 text-lg" aria-hidden>{icon}</span>
            <div>
              <p className="text-sm font-semibold">{i + 1}. {title}</p>
              <p className="text-sm text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
