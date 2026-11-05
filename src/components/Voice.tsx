"use client";

import { useEffect, useRef, useState } from "react";

// Voice in chat, using the browser's built-in speech features (free, no server):
//  - MicButton: speech → text, shown live while speaking (Chrome, Edge, Safari, Android).
//  - SpeakButton: reads a message aloud.
// Browsers only allow the microphone on secure pages (https or localhost).

type SpeechResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
export type SpeechRec = {
  start(): void;
  stop(): void;
  abort(): void;
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type SpeechCtor = new () => SpeechRec;

export function recognitionCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Hindi (Devanagari) text → Hindi voice; otherwise the device language (Indian English if the device is Indian). */
export function speechLang(text?: string): string {
  if (text && /[ऀ-ॿ]/.test(text)) return "hi-IN";
  const nav = typeof navigator !== "undefined" ? navigator.language : "en-IN";
  return nav.startsWith("hi") ? "hi-IN" : nav.startsWith("en") ? nav : "en-IN";
}

/**
 * Tap to talk. `onLive` receives the text so far (for a live preview);
 * `onText` receives the final text when you stop.
 */
export function MicButton({ onText, onLive, className = "", size = 44 }: { onText: (t: string) => void; onLive?: (t: string) => void; className?: string; size?: number }) {
  const [state, setState] = useState<"idle" | "listening" | "unsupported" | "blocked">("idle");
  const rec = useRef<SpeechRec | null>(null);
  const finalText = useRef("");

  useEffect(() => {
    if (!recognitionCtor()) setState("unsupported");
    return () => rec.current?.abort();
  }, []);
  if (state === "unsupported") return null;

  function start() {
    const R = recognitionCtor();
    if (!R) return;
    const r = new R();
    r.lang = speechLang();
    r.interimResults = true;
    r.continuous = true;
    finalText.current = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText.current += `${res[0].transcript} `;
        else interim += res[0].transcript;
      }
      onLive?.(`${finalText.current}${interim}`.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setState("blocked");
    };
    r.onend = () => {
      setState((s) => (s === "blocked" ? s : "idle"));
      const t = finalText.current.trim();
      if (t) onText(t);
    };
    rec.current = r;
    setState("listening");
    try {
      r.start();
    } catch {
      setState("idle");
    }
  }

  const listening = state === "listening";
  return (
    <button
      type="button"
      onClick={() => (listening ? rec.current?.stop() : start())}
      aria-label={listening ? "Stop and use what I said" : state === "blocked" ? "Microphone blocked — allow it in your browser settings" : "Speak instead of typing"}
      title={state === "blocked" ? "Microphone blocked. Allow it in the browser (needs https or localhost)." : undefined}
      aria-pressed={listening}
      className={`relative flex shrink-0 items-center justify-center rounded-full transition active:scale-95 ${listening ? "bg-danger text-white" : state === "blocked" ? "bg-card-2 text-danger" : "bg-card-2 text-fg"} ${className}`}
      style={{ width: size, height: size }}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" aria-hidden />}
      {listening ? (
        <svg viewBox="0 0 24 24" className="relative h-5 w-5" fill="currentColor" aria-hidden>
          <rect x="7" y="7" width="10" height="10" rx="2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0014 0M12 18v3" />
        </svg>
      )}
    </button>
  );
}

let speakingId: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Reads text aloud (stops anything already playing). Returns false if speech isn't available. */
export function speakText(text: string, id = "auto", onEnd?: () => void): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_#>`]/g, "").slice(0, 3000));
  u.lang = speechLang(text);
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang === u.lang) ?? voices.find((v) => v.lang.startsWith(u.lang.slice(0, 2)));
  if (voice) u.voice = voice;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (speakingId === id) speakingId = null;
    notify();
    onEnd?.();
  };
  u.onend = finish;
  u.onerror = finish;
  speakingId = id;
  notify();
  synth.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  speakingId = null;
  notify();
}

const VOICE_KEY = "unfold:voiceReplies";

/**
 * Voice replies: when on (remembered on this device), or when the person just
 * spoke their message, each new mentor reply is read aloud automatically.
 */
export function useVoiceReplies(latest: { id: string; text: string; fromMentor: boolean } | null) {
  const [on, setOn] = useState(false);
  const spokeLast = useRef(false);
  const lastSeen = useRef<string | null>(latest?.id ?? null);
  useEffect(() => {
    setOn(localStorage.getItem(VOICE_KEY) === "1");
  }, []);
  useEffect(() => {
    if (!latest || latest.id === lastSeen.current) return;
    lastSeen.current = latest.id;
    if (latest.fromMentor && (on || spokeLast.current)) speakText(latest.text, latest.id);
    if (latest.fromMentor) spokeLast.current = false;
  }, [latest, on]);
  return {
    on,
    toggle: () => {
      const next = !on;
      setOn(next);
      localStorage.setItem(VOICE_KEY, next ? "1" : "0");
      if (!next) stopSpeaking();
    },
    /** Call when the person sends a message they spoke. */
    markSpoken: () => {
      spokeLast.current = true;
    },
  };
}

/** Small switch shown in chats. */
export function VoiceRepliesToggle({ on, toggle }: { on: boolean; toggle: () => void }) {
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(typeof window !== "undefined" && "speechSynthesis" in window), []);
  if (!supported) return null;
  return (
    <button type="button" onClick={toggle} aria-pressed={on} className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${on ? "bg-accent text-on-accent" : "glass text-muted"}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5L6 9H3v6h3l5 4V5z" />
        {on ? <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /> : <path d="M16 9l5 6M21 9l-5 6" />}
      </svg>
      Voice replies {on ? "on" : "off"}
    </button>
  );
}

/** Reads one message aloud; tap again to stop. */
export function SpeakButton({ text, id }: { text: string; id: string }) {
  const [supported, setSupported] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!supported) return null;
  const speaking = speakingId === id;
  return (
    <button
      type="button"
      onClick={() => (speaking ? stopSpeaking() : speakText(text, id))}
      aria-label={speaking ? "Stop reading" : "Read aloud"}
      className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium transition ${speaking ? "bg-accent text-on-accent" : "text-muted hover:bg-card-2"}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5L6 9H3v6h3l5 4V5z" />
        {speaking ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />}
      </svg>
      {speaking ? "Stop" : "Listen"}
    </button>
  );
}
