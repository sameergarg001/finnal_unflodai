"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./ui";

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
    <section className="pt-2" aria-label="Ask your coach">
      <div className="no-scrollbar -mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4">
        {CHIPS.map((c) => (
          <button key={c} type="button" onClick={() => go(c)} className="glass shrink-0 rounded-full px-4 py-2 text-sm font-medium transition active:scale-95">
            {c}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="glass flex items-center gap-2 rounded-full py-1.5 pl-5 pr-1.5"
      >
        <Icon name="spark" className="h-5 w-5 shrink-0 text-sun-ink" />
        <label className="sr-only" htmlFor="home-ask">Ask your coach</label>
        <input
          id="home-ask"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask anything…"
          enterKeyHint="send"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-fg placeholder:text-muted focus:outline-none"
        />
        <button type="submit" aria-label="Ask" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition active:scale-95">
          <Icon name="send" />
        </button>
      </form>
    </section>
  );
}
