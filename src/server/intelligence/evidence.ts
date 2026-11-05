import { db } from "@/lib/db";

// Evidence-based weaknesses and strengths.
//
// Every observation about the person is stored with the exact words or
// feedback that support it. A single sentence only ever creates a
// *hypothesis*; it becomes *confirmed* when it shows up again in a different
// conversation or task. Contradicting evidence (e.g. they did the thing they
// used to avoid) moves it to *improving*, then *resolved*. Observations that
// stop appearing become *outdated*. Users can reject any observation, and a
// rejected one is never re-added from similar wording.

export type InsightKind = "blocker" | "strength" | "pattern" | "preference";
export type InsightStatus = "hypothesis" | "confirmed" | "improving" | "resolved" | "temporary" | "outdated" | "rejected";
export type EvidenceSource = "message" | "feedback" | "analysis";

export interface EvidenceItem {
  quote: string;
  source: EvidenceSource;
  refId: string; // message / challenge id it came from
  at: string; // ISO date
  direction: "supports" | "contradicts";
}

export interface InsightState {
  kind: InsightKind;
  text: string;
  subskill: string | null;
  evidence: EvidenceItem[];
  situations: string[];
  count: number;
  status: InsightStatus;
  confidence: number;
  lastSeenAt: Date;
}

export interface Observation {
  kind: InsightKind;
  /** Short name, e.g. "Hesitates before approaching new people". */
  label: string;
  subskill: string | null;
  /** The user's own words (or a factual summary of their feedback) that show it. */
  quote: string;
  situation: string | null;
  /** The person framed it as a one-off (tired, sick, unusual day). */
  temporary: boolean;
}

const OUTDATED_AFTER_DAYS = { tentative: 45, confirmed: 90 };
const MAX_EVIDENCE = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const STOP = new Set(["the", "and", "with", "when", "before", "after", "about", "into", "from", "that", "this", "they", "their", "them", "you", "your", "for", "has", "have", "gets", "get"]);
/** Very small stemmer so "freezing", "freezes" and "freeze" count as the same word. */
const stem = (w: string) => w.replace(/(ing|edly|ed|es|s|ly)$/, "").replace(/(.)\1$/, "$1");
const words = (s: string) => new Set((s.toLowerCase().match(/[a-z\u0900-\u097f']{3,}/g) ?? []).filter((w) => !STOP.has(w)).map(stem));

export function similarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Finds the existing observation a new one is about (same kind; subskill helps). */
export function findMatch<T extends Pick<InsightState, "kind" | "text" | "subskill">>(existing: T[], kind: InsightKind, label: string, subskill: string | null): T | undefined {
  let best: T | undefined;
  let bestScore = 0;
  for (const e of existing) {
    if (e.kind !== kind) continue;
    const sim = similarity(e.text, label);
    const sameSub = !!subskill && e.subskill === subskill;
    const score = sim + (sameSub ? 0.2 : 0);
    if ((sim >= 0.5 || (sameSub && sim >= 0.25)) && score > bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

const supporting = (ev: EvidenceItem[]) => ev.filter((e) => e.direction === "supports");

/** Status from the evidence alone (pure, testable). */
export function computeStatus(s: Pick<InsightState, "evidence" | "status" | "lastSeenAt">, opts: { temporary?: boolean; now?: Date } = {}): InsightStatus {
  if (s.status === "rejected") return "rejected";
  const now = opts.now ?? new Date();
  const sup = supporting(s.evidence);
  const refs = new Set(sup.map((e) => e.refId));
  const sources = new Set(sup.map((e) => e.source));
  // Contradictions after the latest supporting evidence decide improving/resolved.
  const lastSupport = Math.max(0, ...sup.map((e) => Date.parse(e.at)));
  const laterContra = new Set(s.evidence.filter((e) => e.direction === "contradicts" && Date.parse(e.at) >= lastSupport).map((e) => e.refId));
  if (laterContra.size >= 2) return "resolved";
  if (laterContra.size === 1) return "improving";

  const confirmed = refs.size >= 3 || (refs.size >= 2 && (sources.size >= 2 || spansDays(sup)));
  const days = (now.getTime() - s.lastSeenAt.getTime()) / 86_400_000;
  if (confirmed) return days > OUTDATED_AFTER_DAYS.confirmed ? "outdated" : "confirmed";
  if (days > OUTDATED_AFTER_DAYS.tentative) return "outdated";
  if (opts.temporary && refs.size <= 1) return "temporary";
  if (s.status === "temporary" && refs.size <= 1) return "temporary";
  return "hypothesis";
}

function spansDays(items: EvidenceItem[]): boolean {
  const days = new Set(items.map((e) => e.at.slice(0, 10)));
  return days.size >= 2;
}

/** 0–1 confidence: more independent evidence → higher; contradictions and age lower it. */
export function computeConfidence(s: Pick<InsightState, "evidence" | "lastSeenAt">, now = new Date()): number {
  const sup = supporting(s.evidence);
  const refs = new Set(sup.map((e) => e.refId)).size;
  const sources = new Set(sup.map((e) => e.source)).size;
  const contra = new Set(s.evidence.filter((e) => e.direction === "contradicts").map((e) => e.refId)).size;
  const days = (now.getTime() - s.lastSeenAt.getTime()) / 86_400_000;
  const recency = Math.pow(0.5, days / 60);
  return Math.round(clamp((0.2 + 0.2 * (refs - 1) + 0.1 * (sources - 1) - 0.15 * contra) * (0.5 + 0.5 * recency) + 0.1, 0.1, 0.95) * 100) / 100;
}

/** Adds one piece of supporting evidence (pure). */
export function addSupport(s: InsightState, item: EvidenceItem, situation: string | null, temporary: boolean, now = new Date()): InsightState {
  const duplicate = s.evidence.some((e) => e.refId === item.refId && e.direction === "supports");
  const evidence = duplicate ? s.evidence : [...s.evidence, item].slice(-MAX_EVIDENCE);
  const situations = situation && !s.situations.some((x) => similarity(x, situation) > 0.6) ? [...s.situations, situation.slice(0, 160)].slice(-5) : s.situations;
  const next = { ...s, evidence, situations, count: duplicate ? s.count : s.count + 1, lastSeenAt: now };
  // New support after "improving/resolved" re-opens it (the difficulty is back).
  const reopened = { ...next, status: s.status === "rejected" ? s.status : ("hypothesis" as InsightStatus) };
  return { ...next, status: computeStatus(reopened, { temporary, now }), confidence: computeConfidence(next, now) };
}

/** Adds contradicting evidence, e.g. they clearly did what they used to struggle with (pure). */
export function addContradiction(s: InsightState, item: EvidenceItem, now = new Date()): InsightState {
  if (s.evidence.some((e) => e.refId === item.refId && e.direction === "contradicts")) return s;
  const evidence = [...s.evidence, item].slice(-MAX_EVIDENCE);
  const next = { ...s, evidence, lastSeenAt: now };
  return { ...next, status: computeStatus(next, { now }), confidence: computeConfidence(next, now) };
}

// ─── Database layer ──────────────────────────────────────────────────────

type Row = Awaited<ReturnType<typeof db.userInsight.findMany>>[number];

function toState(r: Row): InsightState {
  return {
    kind: r.kind as InsightKind,
    text: r.text,
    subskill: r.subskill,
    evidence: (Array.isArray(r.evidence) ? r.evidence : []) as unknown as EvidenceItem[],
    situations: (Array.isArray(r.situations) ? r.situations : []) as string[],
    count: r.count,
    status: (r.status as InsightStatus) ?? "hypothesis",
    confidence: r.confidence,
    lastSeenAt: r.lastSeenAt,
  };
}

function toData(s: InsightState) {
  return {
    evidence: s.evidence as unknown as object,
    situations: s.situations,
    count: s.count,
    status: s.status,
    confidence: s.confidence,
    lastSeenAt: s.lastSeenAt,
    strength: s.confidence, // kept in sync for older readers
  };
}

/** Stores new observations as evidence (merging with what's already known). */
export async function recordObservations(userId: string, skillId: string | null, observations: Observation[], ref: { source: EvidenceSource; refId: string }) {
  if (!observations.length) return;
  const existing = await db.userInsight.findMany({ where: { userId, OR: [{ skillId }, { skillId: null }] } });
  const now = new Date();
  for (const o of observations.slice(0, 4)) {
    const label = o.label.trim().slice(0, 200);
    const quote = o.quote.trim().slice(0, 300);
    if (label.length < 4 || quote.length < 2) continue;
    const item: EvidenceItem = { quote, source: ref.source, refId: ref.refId, at: now.toISOString(), direction: "supports" };
    const match = findMatch(existing.map((e) => ({ ...e, kind: e.kind as InsightKind })), o.kind, label, o.subskill);
    if (match) {
      if (match.status === "rejected") continue; // the user said this isn't true
      const next = addSupport(toState(match as Row), item, o.situation, o.temporary, now);
      await db.userInsight.update({ where: { id: match.id }, data: { ...toData(next), subskill: match.subskill ?? o.subskill } });
    } else {
      const base: InsightState = { kind: o.kind, text: label, subskill: o.subskill, evidence: [], situations: [], count: 0, status: "hypothesis", confidence: 0.3, lastSeenAt: now };
      const next = addSupport(base, item, o.situation, o.temporary, now);
      const created = await db.userInsight.create({ data: { userId, skillId, kind: o.kind, text: label, subskill: o.subskill, ...toData(next) } });
      existing.push(created);
    }
  }
}

/** Records evidence against existing observations (improvement or a wrong guess). */
export async function recordContradictions(userId: string, items: { insightId: string; quote: string }[], ref: { source: EvidenceSource; refId: string }) {
  const now = new Date();
  for (const it of items.slice(0, 3)) {
    const row = await db.userInsight.findFirst({ where: { id: it.insightId, userId } });
    if (!row || row.status === "rejected" || !it.quote.trim()) continue;
    const next = addContradiction(toState(row), { quote: it.quote.slice(0, 300), source: ref.source, refId: ref.refId, at: now.toISOString(), direction: "contradicts" }, now);
    await db.userInsight.update({ where: { id: row.id }, data: toData(next) });
  }
}

export interface InsightView {
  id: string;
  kind: InsightKind;
  text: string;
  subskill: string | null;
  status: InsightStatus;
  confidence: number;
  count: number;
  situations: string[];
  evidence: EvidenceItem[];
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * Current observations for a skill (plus general ones), with statuses
 * refreshed for age. Rejected ones are excluded unless asked for.
 */
export async function getInsights(userId: string, skillId: string | null, opts: { includeInactive?: boolean } = {}): Promise<InsightView[]> {
  const rows = await db.userInsight.findMany({ where: { userId, ...(skillId ? { OR: [{ skillId }, { skillId: null }] } : {}) }, orderBy: { lastSeenAt: "desc" } });
  const now = new Date();
  const out: InsightView[] = [];
  for (const r of rows) {
    const st = toState(r);
    const status = st.evidence.length ? computeStatus(st, { now }) : (r.status as InsightStatus);
    if (status !== r.status && st.evidence.length) await db.userInsight.update({ where: { id: r.id }, data: { status } });
    const view: InsightView = {
      id: r.id,
      kind: st.kind,
      text: r.text,
      subskill: r.subskill,
      status,
      confidence: st.evidence.length ? computeConfidence(st, now) : r.confidence,
      count: r.count,
      situations: st.situations,
      evidence: st.evidence,
      firstSeen: r.createdAt,
      lastSeen: r.lastSeenAt,
    };
    if (!opts.includeInactive && ["rejected", "outdated", "resolved"].includes(status)) continue;
    out.push(view);
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

/** User correction: "this isn't true about me". Kept (as rejected) so it isn't re-added. */
export async function rejectInsight(userId: string, insightId: string) {
  await db.userInsight.updateMany({ where: { id: insightId, userId }, data: { status: "rejected" } });
}

/** User deletion: removes the observation and its evidence entirely. */
export async function deleteInsight(userId: string, insightId: string) {
  await db.userInsight.deleteMany({ where: { id: insightId, userId } });
}
