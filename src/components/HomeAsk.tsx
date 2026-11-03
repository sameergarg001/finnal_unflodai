"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CHIPS = ["I'm stuck", "I have 10 minutes", "Talk me through nerves"];

/** Chat-style box on Home: type anything or tap a chip. */
export function HomeAsk() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function go(text: string) {
    const next = text.trim();
    router.push(next ? `/mentor?q=${encodeURIComponent(next.slice(0, 1000))}` : "/mentor");
  }

  return (
    <div className="rounded-3xl border border-line bg-card p-4">
      <p className="mb-2 text-sm font-medium">Ask anything</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="flex items-end gap-2"
      >
        <label className="sr-only" htmlFor="home-ask">
          Ask your coach
        </label>
        <textarea
          id="home-ask"
          rows={1}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              go(q);
            }
          }}
          placeholder="What's on your mind?"
          className="block min-h-12 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-base text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          aria-label="Ask"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white transition active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => go(c)}
            className="rounded-full border border-line bg-card-2 px-3 py-1.5 text-xs font-medium text-fg transition hover:border-accent/50 active:scale-95"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
