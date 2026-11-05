"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TeacherAvatar } from "./ui";
import { recognitionCtor, speakText, speechLang, stopSpeaking, type SpeechRec } from "./Voice";

// Hands-free "call" with the mentor: listen → send → speak the reply → listen again.
// Uses the browser's own speech recognition and voices (free; needs https or localhost for the mic).

type Phase = "starting" | "listening" | "thinking" | "speaking" | "paused" | "unsupported" | "blocked";

export interface CallMessage {
  id: string;
  text: string;
  fromMentor: boolean;
  kind: string;
}

export function VoiceCall({
  name,
  emoji,
  latest,
  send,
  onEnd,
}: {
  name: string;
  emoji: string;
  /** The newest message in the conversation (the call speaks new mentor messages). */
  latest: CallMessage | null;
  /** Sends what the person said; resolves when the server has replied (or with an error). */
  send: (text: string) => Promise<string | null>;
  onEnd: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [heard, setHeard] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SpeechRec | null>(null);
  const spokenIds = useRef(new Set<string>());
  const silentTries = useRef(0);
  const active = useRef(true);
  const waitingReply = useRef(false);

  const listen = useCallback(() => {
    if (!active.current) return;
    const R = recognitionCtor();
    if (!R) return setPhase("unsupported");
    const r = new R();
    r.lang = speechLang();
    r.interimResults = true;
    r.continuous = false; // stops by itself when the person pauses
    let finalText = "";
    let blocked = false;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setHeard(`${finalText}${interim}`.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        blocked = true;
        setPhase("blocked");
      }
    };
    r.onend = async () => {
      rec.current = null;
      if (!active.current || blocked) return;
      const text = finalText.trim();
      if (!text) {
        // Silence: keep listening a few times, then pause so the mic isn't on forever.
        silentTries.current += 1;
        if (silentTries.current >= 3) return setPhase("paused");
        return listen();
      }
      silentTries.current = 0;
      setPhase("thinking");
      waitingReply.current = true;
      const err = await send(text);
      if (err) {
        waitingReply.current = false;
        setError(err);
        setPhase("paused");
      }
    };
    rec.current = r;
    setHeard("");
    setError(null);
    setPhase("listening");
    try {
      r.start();
    } catch {
      setPhase("paused");
    }
  }, [send]);

  const say = useCallback(
    (m: CallMessage) => {
      spokenIds.current.add(m.id);
      const text = m.kind === "challenge" ? `I've designed a task for you: ${m.text}. It's on your screen — take it, ask for another, or tell me more.` : m.text;
      setCaption(text);
      setPhase("speaking");
      const ok = speakText(text, `call-${m.id}`, () => {
        if (active.current) listen();
      });
      if (!ok) listen();
    },
    [listen],
  );

  // Start: greet with the last mentor message if it's the newest thing, otherwise just listen.
  useEffect(() => {
    if (!recognitionCtor()) {
      setPhase("unsupported");
      return;
    }
    active.current = true;
    if (latest?.fromMentor) say(latest);
    else listen();
    return () => {
      active.current = false;
      rec.current?.abort();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new mentor message arrived (after we sent something): speak it.
  useEffect(() => {
    if (!latest || !latest.fromMentor || spokenIds.current.has(latest.id)) return;
    if (!waitingReply.current && phase !== "thinking") {
      spokenIds.current.add(latest.id);
      return;
    }
    waitingReply.current = false;
    say(latest);
  }, [latest, phase, say]);

  const status: Record<Phase, string> = {
    starting: "Connecting…",
    listening: "Listening… just talk",
    thinking: `${name} is thinking…`,
    speaking: `${name} is speaking`,
    paused: "Paused — tap the mic to talk",
    unsupported: "Voice calls need Chrome, Edge or Safari",
    blocked: "Microphone blocked — allow it in the browser (needs https or localhost)",
  };

  return (
    <div className="glass space-y-3 rounded-[28px] p-4" role="region" aria-label={`Voice call with ${name}`}>
      <div className="flex items-center gap-3">
        <span className="relative">
          {(phase === "speaking" || phase === "listening") && <span className={`absolute -inset-1.5 animate-ping rounded-full ${phase === "speaking" ? "bg-accent/30" : "bg-danger/25"}`} aria-hidden />}
          <TeacherAvatar emoji={emoji} size={52} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold leading-tight">Call with {name}</p>
          <p className="text-xs text-muted" aria-live="polite">{status[phase]}</p>
        </div>
      </div>

      {(heard || caption) && (
        <div className="space-y-1.5 rounded-2xl bg-card-2/50 px-3.5 py-2.5 text-sm">
          {caption && phase !== "listening" && <p className="line-clamp-3 text-muted">{caption}</p>}
          {heard && <p className="font-medium">“{heard}”</p>}
        </div>
      )}
      {error && <p className="rounded-2xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => {
            if (phase === "listening") rec.current?.stop();
            else if (phase === "speaking") {
              stopSpeaking();
              listen();
            } else if (phase === "paused" || phase === "blocked") {
              silentTries.current = 0;
              listen();
            }
          }}
          disabled={phase === "thinking" || phase === "unsupported" || phase === "starting"}
          aria-label={phase === "listening" ? "Done talking — send" : phase === "speaking" ? "Interrupt and talk" : "Talk"}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40 ${phase === "listening" ? "bg-accent text-on-accent" : "bg-card-2 text-fg"}`}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            {phase === "listening" ? <path d="M5 12.5l4.5 4.5L19 7" /> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>}
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            active.current = false;
            rec.current?.abort();
            stopSpeaking();
            onEnd();
          }}
          aria-label="End call"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 rotate-[135deg]" fill="currentColor" aria-hidden>
            <path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" />
          </svg>
        </button>
      </div>
      <p className="text-center text-[11px] text-muted">Pause when you&apos;re done talking — it sends by itself.</p>
    </div>
  );
}
