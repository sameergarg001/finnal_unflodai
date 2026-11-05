"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { askMentorAction } from "../../app/actions";
import { Icon, LogoLoader, input } from "./ui";
import { MicButton, SpeakButton, VoiceRepliesToggle, useVoiceReplies } from "./Voice";

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
      <Bubble id="pending" role="user" content={String(data?.get("question") ?? "")} />
      <div className="flex"><div className="glass flex items-center gap-2.5 rounded-[22px] rounded-bl-md py-2.5 pl-3 pr-4 text-sm text-muted"><LogoLoader size={26} label="Coach is thinking" /><span aria-hidden>Thinking…</span></div></div>
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

function Bubble({ id, role, content }: { id: string; role: string; content: string }) {
  const mine = role === "user";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[84%] whitespace-pre-line px-4 py-3 text-[15px] leading-relaxed ${
          mine ? "rounded-[22px] rounded-br-md bg-accent text-on-accent" : "glass rounded-[22px] rounded-bl-md"
        }`}
      >
        {content}
      </div>
      {!mine && <div className="mt-0.5 pl-1"><SpeakButton id={id} text={content} /></div>}
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
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const last = messages[messages.length - 1];
  const replies = useVoiceReplies(last ? { id: last.id, text: last.content, fromMentor: last.role !== "user" } : null);
  const base = useRef<string | null>(null);
  const putVoice = (t: string) => {
    const el = boxRef.current;
    if (!el) return;
    if (base.current === null) base.current = el.value.trim();
    el.value = [base.current, t].filter(Boolean).join(" ");
  };

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
          {messages.map((m) => <Bubble key={m.id} id={m.id} role={m.role} content={m.content} />)}
          <div ref={endRef} />
        </div>
      )}
      <form ref={formRef} action={action} className="space-y-2">
        <Pending />
        {challengeId && <input type="hidden" name="challengeId" value={challengeId} />}
        <div className="glass flex items-end gap-2 rounded-[26px] py-1.5 pl-2 pr-1.5">
          <textarea ref={boxRef} name="question" rows={1} required maxLength={1000} placeholder={placeholder} defaultValue={draft} autoFocus={Boolean(draft)} className={`${input} !mt-0 min-h-11 flex-1 resize-none !border-0 !bg-transparent !py-2.5 focus:!ring-0`} />
          <MicButton onLive={putVoice} onText={(t: string) => { putVoice(t); base.current = null; replies.markSpoken(); boxRef.current?.focus(); }} />
          <SendButton />
        </div>
        <div className="flex justify-end"><VoiceRepliesToggle on={replies.on} toggle={replies.toggle} /></div>
        {state?.error && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{state.error}</p>}
      </form>
    </div>
  );
}
