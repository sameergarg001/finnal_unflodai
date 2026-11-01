"use client";

import { useState } from "react";

export function SelfScoreSlider({ initial, name = "selfScore", optional }: { initial: number | null; name?: string; optional?: boolean }) {
  const [v, setV] = useState<number | null>(optional ? null : (initial ?? 50));
  const shown = v ?? 50;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{optional && v == null ? "Self-rating (optional)" : "Self-rating"}</span>
        <span className="text-xl font-bold tabular-nums">{v == null ? "—" : v}<span className="text-xs text-muted">/100</span></span>
      </div>
      <input type="hidden" name={name} value={v ?? ""} />
      <input
        type="range"
        min={0}
        max={100}
        value={shown}
        onChange={(e) => setV(Number(e.target.value))}
        aria-label="Self-rating"
        className="slider mt-3 w-full"
        style={{ ["--pct" as string]: `${v == null ? 0 : shown}%` }}
      />
    </div>
  );
}
