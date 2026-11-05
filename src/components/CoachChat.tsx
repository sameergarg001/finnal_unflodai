"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { challengeActionAction, coachMessageAction } from "../../app/actions";
import { ChallengeBody, type ChallengeView } from "./ChallengeCard";
import { Spinner } from "./SubmitButton";
import { Icon, LogoLoader, Notice, input } from "./ui";
import { MicButton, SpeakButton, VoiceRepliesToggle, useVoiceReplies } from "./Voice";

export interface Msg {
  id: string;
  role: string;
  kind: string;
  content: string;
  challengeId: string | null;
}

function Bubble({ role, children, speak }: { role: string; children: React.ReactNode; speak?: { id: string; text: string } }) {
  const mine = role === "user";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`max-w-[84%] whitespace-pre-line px-4 py-3 text-[15px] leading-relaxed ${mine ? "rounded-[22px] rounded-br-md bg-accent text-on-accent" : "glass rounded-[22px] rounded-bl-md"}`}>
        {children}
      </div>
      {speak && !mine && <div className="mt-0.5 pl-1"><SpeakButton id={speak.id} text={speak.text} /></div>}
    </div>
  );
}

/** Puts spoken words into the message box live, keeping anything already typed. */
function useVoiceInto(box: React.RefObject<HTMLTextAreaElement | null>) {
  const base = useRef<string | null>(null);
  const put = (t: string) => {
    const el = box.current;
    if (!el) return;
    if (base.current === null) base.current = el.value.trim();
    el.value = [base.current, t].filter(Boolean).join(" ");
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  return {
    onLive: put,
    onText: (t: string) => {
      put(t);
      base.current = null;
      box.current?.focus();
    },
  };
}

function Thinking() {
  return (
    <div className="flex justify-start">
      <div className="glass flex items-center gap-2.5 rounded-[22px] rounded-bl-md py-2.5 pl-3 pr-4 text-sm text-muted"><LogoLoader size={26} label="Coach is thinking" /><span aria-hidden>Thinking…</span></div>
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
      className={`flex items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60 ${
        primary ? "col-span-2 min-h-13 bg-accent text-base text-on-accent shadow-[0_10px_24px_-12px_var(--accent)]" : "min-h-11 bg-card-2"
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
    <div className="glass overflow-hidden rounded-[28px]">
      <div className="flex items-center gap-2 bg-gradient-to-r from-sun-soft to-accent-soft px-5 py-3">
        <Icon name="target" className="h-4 w-4 text-sun-ink" />
        <p className="text-sm font-semibold">Today&apos;s task</p>
      </div>
      <div className="p-5">
      <ChallengeBody c={c} compact />
      {current && c.status === "proposed" ? (
        <form action={action} className="mt-5 grid grid-cols-2 gap-2">
          <input type="hidden" name="challengeId" value={c.id} />
          <ActionButton action="accept" primary><Icon name="check" />Take this task</ActionButton>
          <ActionButton action="another"><Icon name="refresh" className="h-4 w-4" />Another one</ActionButton>
          <ActionButton action="easier">Make it easier</ActionButton>
          <ActionButton action="explain">Explain how</ActionButton>
          <button type="button" onClick={onTell} className="min-h-11 rounded-full bg-card-2 px-3 text-sm font-semibold">More about me</button>
          {state?.error && <div className="col-span-2"><Notice tone="error">{state.error}</Notice></div>}
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {c.status === "active" ? <Link href={`/challenge/${c.id}`} className="inline-flex items-center gap-1 font-semibold text-accent"><Icon name="check" className="h-4 w-4" />Accepted · open task</Link> : c.status === "done" ? <Link href={`/challenge/${c.id}`} className="inline-flex items-center gap-1 font-semibold text-accent"><Icon name="trend" className="h-4 w-4" />Completed · see analysis</Link> : c.status === "discarded" ? "Replaced" : c.status}
        </p>
      )}
      </div>
    </div>
  );
}

// Quick replies come from the mentor (generated for this moment) — no fixed chips.

export function CoachChat({
  conversationId,
  messages,
  challenges,
  phase,
  placeholder,
  activeChallengeId,
  quick,
}: {
  conversationId: string;
  messages: Msg[];
  challenges: Record<string, ChallengeView>;
  phase: string;
  placeholder: string;
  activeChallengeId?: string | null;
  /** Server-provided quick replies (override the per-phase defaults). */
  quick?: string[] | null;
}) {
  const chips = quick ?? [];
  const [state, action] = useActionState(coachMessageAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const lastMsg = [...messages].reverse().find((m) => m.kind === "text" || m.kind === "report");
  const replies = useVoiceReplies(lastMsg ? { id: lastMsg.id, text: lastMsg.content, fromMentor: lastMsg.role !== "user" } : null);
  const mic = useVoiceInto(boxRef);
  // Speaking a message means the mentor answers out loud too.
  const voice = { onLive: mic.onLive, onText: (t: string) => { mic.onText(t); replies.markSpoken(); } };
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
          if (m.kind === "event") return <p key={m.id} className="mx-auto w-fit rounded-full bg-card-2/70 px-3 py-1 text-center text-xs text-muted">{m.content}</p>;
          if (m.kind === "plan") {
            return (
              <div key={m.id} className="rounded-[24px] bg-accent-soft p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-accent"><Icon name="flag" className="h-4 w-4" />Your plan</p>
                <p className="mt-1.5 whitespace-pre-line text-[15px] leading-relaxed">{m.content}</p>
              </div>
            );
          }
          if (m.kind === "report") {
            return (
              <Bubble key={m.id} role="coach" speak={{ id: m.id, text: m.content }}>
                <span className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-accent"><Icon name="trend" className="h-4 w-4" />Analysis</span>
                {m.content}
                {m.challengeId && <Link href={`/challenge/${m.challengeId}`} className="mt-2 block text-sm font-semibold text-accent">See full report</Link>}
              </Bubble>
            );
          }
          return <Bubble key={m.id} role={m.role} speak={m.role === "user" ? undefined : { id: m.id, text: m.content }}>{m.content}</Bubble>;
        })}
        {phase === "feedback" && <Thinking />}
        <div ref={endRef} />
      </div>

      <form ref={formRef} action={action} className="sticky bottom-0 -mx-4 space-y-2 bg-gradient-to-t from-bg via-bg to-bg/0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4">
        <div className="space-y-3 pb-2"><PendingMessage /></div>
        <input type="hidden" name="conversationId" value={conversationId} />
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        <div className="flex justify-end"><VoiceRepliesToggle on={replies.on} toggle={replies.toggle} /></div>
        {(chips.length > 0 || (phase === "active" && activeChallengeId)) && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {phase === "active" && activeChallengeId && (
              <Link href={`/challenge/${activeChallengeId}?feedback=1`} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent">
                <Icon name="check" className="h-4 w-4" />I tried it — report back
              </Link>
            )}
            {chips.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  if (!boxRef.current) return;
                  boxRef.current.value = q;
                  formRef.current?.requestSubmit();
                }}
                className="glass shrink-0 rounded-full px-4 py-2.5 text-sm font-medium active:scale-95"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="glass flex items-end gap-2 rounded-[26px] py-1.5 pl-2 pr-1.5">
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
          <MicButton {...voice} />
          <SendButton />
        </div>
      </form>
    </div>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent active:scale-95 disabled:opacity-50">
      {pending ? <Spinner /> : <Icon name="send" />}
    </button>
  );
}
