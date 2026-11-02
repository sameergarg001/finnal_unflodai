"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { challengeActionAction, coachMessageAction } from "../../app/actions";
import { ChallengeBody, type ChallengeView } from "./ChallengeCard";
import { Spinner } from "./SubmitButton";
import { Notice, input } from "./ui";

export interface Msg {
  id: string;
  role: string;
  kind: string;
  content: string;
  challengeId: string | null;
}

function Bubble({ role, children }: { role: string; children: React.ReactNode }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] whitespace-pre-line rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed ${mine ? "rounded-br-lg bg-accent text-white" : "rounded-bl-lg border border-line bg-card"}`}>
        {children}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-3xl rounded-bl-lg border border-line bg-card px-4 py-3.5" aria-label="Coach is thinking">
        {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </div>
    </div>
  );
}

function PendingMessage() {
  const { pending, data } = useFormStatus();
  if (!pending) return null;
  const text = String(data?.get("message") ?? "");
  return (
    <>
      {text && <Bubble role="user">{text}</Bubble>}
      <Thinking />
    </>
  );
}

function ActionButton({ action, children, primary }: { action: string; children: React.ReactNode; primary?: boolean }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("action") === action;
  return (
    <button
      type="submit"
      name="action"
      value={action}
      disabled={pending}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60 ${
        primary ? "col-span-2 bg-gradient-to-r from-accent to-accent-strong text-white" : "border border-line bg-card-2"
      }`}
    >
      {mine ? <Spinner /> : null}
      {children}
    </button>
  );
}

function ChallengeMessage({ c, current, onTell }: { c: ChallengeView; current: boolean; onTell: () => void }) {
  const [state, action] = useActionState(challengeActionAction, undefined);
  return (
    <div className="rounded-3xl border border-accent/40 bg-gradient-to-b from-accent/10 to-card p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-accent">🎯 Your challenge</p>
      <ChallengeBody c={c} compact />
      {current && c.status === "proposed" ? (
        <form action={action} className="mt-5 grid grid-cols-2 gap-2">
          <input type="hidden" name="challengeId" value={c.id} />
          <ActionButton action="accept" primary>Take this challenge</ActionButton>
          <ActionButton action="another">Another one</ActionButton>
          <ActionButton action="easier">Make it easier</ActionButton>
          <ActionButton action="explain">Explain how</ActionButton>
          <button type="button" onClick={onTell} className="min-h-11 rounded-2xl border border-line bg-card-2 px-3 py-2.5 text-sm font-semibold">More about me</button>
          {state?.error && <div className="col-span-2"><Notice tone="error">{state.error}</Notice></div>}
        </form>
      ) : (
        <p className="mt-4 text-xs text-muted">
          {c.status === "active" ? <Link href={`/challenge/${c.id}`} className="font-semibold text-accent">Accepted — open challenge →</Link> : c.status === "done" ? <Link href={`/challenge/${c.id}`} className="font-semibold text-accent">Completed — see analysis →</Link> : c.status === "discarded" ? "Replaced" : c.status}
        </p>
      )}
    </div>
  );
}

const QUICK: Record<string, string[]> = {
  understanding: ["Just give me a challenge"],
  active: ["I'm stuck — how do I start?", "What should I say first?"],
  reviewed: ["Give me my next challenge", "I want to work on something else"],
};

export function CoachChat({
  conversationId,
  messages,
  challenges,
  phase,
  placeholder,
  activeChallengeId,
}: {
  conversationId: string;
  messages: Msg[];
  challenges: Record<string, ChallengeView>;
  phase: string;
  placeholder: string;
  activeChallengeId?: string | null;
}) {
  const [state, action] = useActionState(coachMessageAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const currentChallengeId = [...messages].reverse().find((m) => m.kind === "challenge")?.challengeId;

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
      <div className="flex-1 space-y-3 pb-4">
        {messages.map((m) => {
          if (m.kind === "challenge" && m.challengeId && challenges[m.challengeId]) {
            return <ChallengeMessage key={m.id} c={challenges[m.challengeId]} current={m.challengeId === currentChallengeId} onTell={() => boxRef.current?.focus()} />;
          }
          if (m.kind === "event") return <p key={m.id} className="text-center text-xs text-muted">{m.content}</p>;
          if (m.kind === "report") {
            return (
              <Bubble key={m.id} role="coach">
                <span className="mb-1 block text-xs font-semibold text-accent">📊 Analysis</span>
                {m.content}
                {m.challengeId && <Link href={`/challenge/${m.challengeId}`} className="mt-2 block text-sm font-semibold text-accent">See full report →</Link>}
              </Bubble>
            );
          }
          return <Bubble key={m.id} role={m.role}>{m.content}</Bubble>;
        })}
        {phase === "feedback" && <Thinking />}
        <div ref={endRef} />
      </div>

      <form ref={formRef} action={action} className="sticky bottom-0 -mx-4 space-y-2 bg-gradient-to-t from-bg via-bg to-bg/0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4">
        <div className="space-y-3 pb-2"><PendingMessage /></div>
        <input type="hidden" name="conversationId" value={conversationId} />
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        {(QUICK[phase] || (phase === "active" && activeChallengeId)) && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {phase === "active" && activeChallengeId && (
              <Link href={`/challenge/${activeChallengeId}?feedback=1`} className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">
                ✓ I tried it — report back
              </Link>
            )}
            {(QUICK[phase] ?? []).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  if (!boxRef.current) return;
                  boxRef.current.value = q;
                  formRef.current?.requestSubmit();
                }}
                className="shrink-0 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium active:scale-95"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-3xl border border-line bg-card p-1.5">
          <textarea
            ref={boxRef}
            name="message"
            rows={1}
            required
            maxLength={1500}
            placeholder={placeholder}
            className={`${input} !mt-0 max-h-40 min-h-11 flex-1 resize-none !border-0 !bg-transparent !py-2.5 focus:!ring-0`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${t.scrollHeight}px`;
            }}
          />
          <SendButton />
        </div>
      </form>
    </div>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white active:scale-95 disabled:opacity-50">
      {pending ? <Spinner /> : <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
    </button>
  );
}
