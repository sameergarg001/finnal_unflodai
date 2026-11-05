import type { AttemptResult } from "../engine/scoring";
import type { Observation } from "./evidence";

// Backend checks on AI output. The model can suggest; only validated facts are stored.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * True if a quoted piece of "evidence" actually comes from what the user wrote
 * (exact substring, or most of its words appear) — so the AI can't invent evidence.
 */
export function quoteSupported(quote: string, source: string): boolean {
  const q = norm(quote);
  const s = norm(source);
  if (!q || !s) return false;
  if (s.includes(q)) return true;
  const words = q.split(" ").filter((w) => w.length > 2);
  if (!words.length) return false;
  const hits = words.filter((w) => s.includes(w)).length;
  return hits / words.length >= 0.6;
}

export function validSubskill(key: string | null | undefined, subskills: { key: string; label: string }[]): string | null {
  if (!key) return null;
  const n = (v: string) => v.trim().toLowerCase().replace(/[\s_-]+/g, "-");
  const k = n(key);
  return subskills.find((s) => n(s.key) === k || n(s.label) === k)?.key ?? null;
}

/** Keeps observations whose quote is grounded in the source text; normalises subskill keys. */
export function groundObservations(
  obs: { kind: Observation["kind"]; label: string; subskill: string | null; quote: string; situation: string | null; temporary: boolean }[],
  source: string,
  subskills: { key: string; label: string }[],
): Observation[] {
  return obs.filter((o) => quoteSupported(o.quote, source)).map((o) => ({ ...o, subskill: validSubskill(o.subskill, subskills) }));
}

/** Plain-language explanation of a score change (or why it didn't change). */
export function explainScoreChange(skill: string, before: number, r: AttemptResult, evidenceSummary: string): string {
  const b = Math.round(before * 10) / 10;
  const a = Math.round(r.score * 10) / 10;
  const what = evidenceSummary.trim().replace(/\.$/, "");
  if (r.delta > 0) return `Your ${skill} score went from ${b} to ${a} because ${what ? lowerFirst(what) : "your account showed the skill clearly"}.`;
  if (r.delta < 0)
    return `Your ${skill} score went from ${b} to ${a}: the last few attempts showed the same difficulty clearly. It's a small, reviewable change — tap "Ask for a review" if this seems wrong.`;
  if (r.tier === "none" && /evidence|specific|feelings|claims/.test(r.rule))
    return `Your ${skill} score stays at ${b} for now — there wasn't enough specific detail about what you actually did to count as evidence. Describing who, what was said and what happened helps next time.`;
  if (r.rule.startsWith("not attempted")) return `Your ${skill} score stays at ${b}. Not getting to it is never a penalty.`;
  return `Your ${skill} score stays at ${b}: this attempt didn't yet show clear improvement in the skill itself. That's normal — it's information for the next task, not a penalty.`;
}

function lowerFirst(s: string) {
  if (/^I\b/.test(s)) return s.replace(/^I\b/, "you");
  if (/^you\b/i.test(s)) return s.replace(/^you\b/i, "you");
  // A clause that starts with a verb ("approached Rahul…") reads as "because you approached Rahul…".
  if (/^[A-Za-z]+(ed|ing)?\b/.test(s) && !/^(the|a|an|they|she|he|it|your|their|after|during|in|at|on)\b/i.test(s)) return `you ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
  if (/^[A-Z]{2,}/.test(s)) return s; // acronym / name in caps
  return s.charAt(0).toLowerCase() + s.slice(1);
}
