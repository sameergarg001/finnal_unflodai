"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { feedbackAction } from "../../app/actions";
import { SubmitButton } from "./SubmitButton";
import { Notice, btnPrimary, btnSecondary, input } from "./ui";

const STATUSES = [
  { value: "completed", label: "Completed successfully", icon: "✅" },
  { value: "partial", label: "Partially completed", icon: "🌗" },
  { value: "unsuccessful", label: "Attempted but unsuccessful", icon: "💪" },
  { value: "not_attempted", label: "Could not attempt", icon: "⏸️" },
] as const;

const NOT_ATTEMPTED_QUESTIONS = ["What got in the way?", "How did you feel about the challenge?", "What would make it easier to start next time?"];

type SpeechRec = { start(): void; stop(): void; lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null };

/** Voice input via the browser's speech recognition, when available. */
function MicButton({ onText }: { onText: (t: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);
  if (!supported) return null;
  return (
    <button
      type="button"
      aria-label={listening ? "Stop voice input" : "Speak your answer"}
      onClick={() => {
        if (listening) return rec.current?.stop();
        const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
        const R = (w.SpeechRecognition ?? w.webkitSpeechRecognition)!;
        const r = new R();
        r.lang = navigator.language || "en-US";
        r.interimResults = false;
        r.continuous = false;
        r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
        r.onend = () => setListening(false);
        rec.current = r;
        setListening(true);
        r.start();
      }}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${listening ? "animate-pulse bg-danger text-white" : "border border-line bg-card-2"}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
    </button>
  );
}

/** Conversational feedback: how did it go → one question at a time → send. */
export function FeedbackFlow({ challengeId, questions }: { challengeId: string; questions: string[] }) {
  const [state, action] = useActionState(feedbackAction, undefined);
  const [status, setStatus] = useState<string | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState("");
  const qs = status === "not_attempted" ? NOT_ATTEMPTED_QUESTIONS : questions;
  const done = status !== null && step >= qs.length;
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }), [step, status]);

  const next = (skip = false) => {
    const a = [...answers];
    a[step] = skip ? "" : draft.trim();
    setAnswers(a);
    setDraft(a[step + 1] ?? "");
    setStep(step + 1);
  };
  const responses = qs.map((q, i) => ({ question: q, answer: answers[i] ?? "" }));
  const answered = responses.filter((r) => r.answer).length;

  return (
    <div className="space-y-3">
      <Coach>Welcome back! Did you get a chance to try the challenge?</Coach>
      {status === null ? (
        <div className="grid gap-2">
          {STATUSES.map((s) => (
            <button key={s.value} type="button" onClick={() => setStatus(s.value)} className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 text-left font-medium active:scale-[0.98]">
              <span className="text-xl">{s.icon}</span>{s.label}
            </button>
          ))}
          <p className="px-1 text-xs text-muted">Every honest answer helps — an unsuccessful attempt is useful information, never a failure.</p>
        </div>
      ) : (
        <>
          <Me>{STATUSES.find((s) => s.value === status)!.label}</Me>
          {qs.slice(0, Math.min(step + 1, qs.length)).map((q, i) => (
            <div key={q} className="space-y-3">
              <Coach>{q}</Coach>
              {i < step && (answers[i] ? <Me>{answers[i]}</Me> : <p className="text-right text-xs text-muted">skipped</p>)}
            </div>
          ))}
          {!done && (
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <textarea
                  autoFocus
                  rows={3}
                  value={draft}
                  maxLength={3000}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type, or tap the mic to speak…"
                  className={`${input} !mt-0 flex-1 resize-none`}
                />
                <MicButton onText={(t) => setDraft((d) => (d ? `${d} ${t}` : t))} />
              </div>
              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <button type="button" onClick={() => next(true)} className={btnSecondary}>Skip</button>
                <button type="button" disabled={!draft.trim()} onClick={() => next()} className={btnPrimary}>Next</button>
              </div>
              <button type="button" onClick={() => { setStatus(null); setStep(0); setAnswers([]); setDraft(""); }} className="w-full py-1 text-xs text-muted">← change answer</button>
            </div>
          )}
          {done && (
            <form action={action} className="space-y-2 pt-2">
              <input type="hidden" name="challengeId" value={challengeId} />
              <input type="hidden" name="completionStatus" value={status} />
              <input type="hidden" name="responses" value={JSON.stringify(responses)} />
              {answered === 0 && <Notice tone="error">Please answer at least one question so your coach can help.</Notice>}
              {state?.error && <Notice tone="error">{state.error}</Notice>}
              {answered > 0 && <SubmitButton pendingText="Sending to your coach…">Send to my coach</SubmitButton>}
              <button type="button" onClick={() => { setStep(Math.max(0, qs.length - 1)); setDraft(answers[qs.length - 1] ?? ""); }} className="w-full py-1 text-xs text-muted">← edit last answer</button>
            </form>
          )}
        </>
      )}
      <div ref={endRef} />
    </div>
  );
}

function Coach({ children }: { children: React.ReactNode }) {
  return <div className="flex"><div className="max-w-[85%] rounded-3xl rounded-bl-lg border border-line bg-card px-4 py-2.5 text-[15px]">{children}</div></div>;
}
function Me({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end"><div className="max-w-[85%] whitespace-pre-line rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-[15px] text-white">{children}</div></div>;
}
