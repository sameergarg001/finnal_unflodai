"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { askMentorAction } from "../../app/actions";
import { btnPrimary, input } from "./ui";

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

function Pending() {
  const { pending, data } = useFormStatus();
  if (!pending) return null;
  return (
    <>
      <Bubble role="user" content={String(data?.get("question") ?? "")} />
      <p className="animate-pulse text-sm text-slate-500">Your mentor is thinking…</p>
    </>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btnPrimary}>
      {pending ? "…" : "Ask"}
    </button>
  );
}

function Bubble({ role, content }: { role: string; content: string }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2 text-sm ${
          mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

export function MentorChat({
  messages,
  challengeId,
  placeholder = "e.g. What do I say if someone interrupts me?",
}: {
  messages: ChatMessage[];
  challengeId?: string;
  placeholder?: string;
}) {
  const [state, action] = useActionState(askMentorAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Clear the box after a successful answer and scroll to the newest message.
  useEffect(() => {
    if (state && !state.error) formRef.current?.reset();
  }, [state]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  return (
    <div>
      {messages.length > 0 && (
        <div className="mb-4 max-h-96 space-y-3 overflow-y-auto pr-1">
          {messages.map((m) => <Bubble key={m.id} role={m.role} content={m.content} />)}
          <div ref={endRef} />
        </div>
      )}
      <form ref={formRef} action={action} className="space-y-2">
        <Pending />
        {challengeId && <input type="hidden" name="challengeId" value={challengeId} />}
        <div className="flex gap-2">
          <textarea name="question" rows={2} required maxLength={1000} placeholder={placeholder} className={`${input} !mt-0`} />
          <SendButton />
        </div>
        {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      </form>
    </div>
  );
}
