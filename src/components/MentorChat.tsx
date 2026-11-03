"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { askMentorAction } from "../../app/actions";
import { Icon, input } from "./ui";

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
      <div className="flex"><div className="glass flex items-center gap-1.5 rounded-[22px] rounded-bl-md px-4 py-4" aria-label="Coach is thinking">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />)}</div></div>
    </>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Send"
      className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full bg-accent text-on-accent active:scale-95 disabled:opacity-50"
    >
      <Icon name="send" />
    </button>
  );
}

function Bubble({ role, content }: { role: string; content: string }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[84%] whitespace-pre-line px-4 py-3 text-[15px] leading-relaxed ${
          mine ? "rounded-[22px] rounded-br-md bg-accent text-on-accent" : "glass rounded-[22px] rounded-bl-md"
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
  draft = "",
}: {
  messages: ChatMessage[];
  challengeId?: string;
  placeholder?: string;
  draft?: string;
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
        <div className="mb-4 space-y-3">
          {messages.map((m) => <Bubble key={m.id} role={m.role} content={m.content} />)}
          <div ref={endRef} />
        </div>
      )}
      <form ref={formRef} action={action} className="space-y-2">
        <Pending />
        {challengeId && <input type="hidden" name="challengeId" value={challengeId} />}
        <div className="glass flex items-end gap-2 rounded-[26px] py-1.5 pl-2 pr-1.5">
          <textarea name="question" rows={1} required maxLength={1000} placeholder={placeholder} defaultValue={draft} autoFocus={Boolean(draft)} className={`${input} !mt-0 min-h-11 flex-1 resize-none !border-0 !bg-transparent !py-2.5 focus:!ring-0`} />
          <SendButton />
        </div>
        {state?.error && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{state.error}</p>}
      </form>
    </div>
  );
}
