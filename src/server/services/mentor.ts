import { z } from "zod";
import { db } from "@/lib/db";
import { generateStructured } from "@/ai/client";
import { userData } from "@/ai/prompts";
import { MENTOR_PERSONA, observationSchema, situationSchema } from "@/ai/intelligencePrompts";
import { getInsights, recordObservations } from "../intelligence/evidence";
import { groundObservations } from "../intelligence/guards";
import { saveSituation } from "../intelligence/situation";
import { stageForScore } from "../intelligence/stages";
import { frameworkOf } from "./skills";

// "Ask anything": a general conversation with the mentor across all skills.
// Same engine as skill sessions: real context in, structured reply out, and
// anything the person reveals about themselves becomes evidence-backed memory.

const firstName = (name: string | null | undefined) => (name ?? "there").trim().split(/\s+/)[0] || "there";
type UserLite = { id: string; name: string | null; timezone: string };

const DAILY_MESSAGE_LIMIT = 30;

export async function getMentorMessages(userId: string, challengeId: string | null) {
  const rows = await db.mentorMessage.findMany({ where: { userId, challengeId }, orderBy: { createdAt: "desc" }, take: 20 });
  return rows.reverse();
}

export class MentorError extends Error {}

const askSchema = z.object({
  reply: z.string().trim().min(1).transform((s) => s.slice(0, 1500)),
  skill: z
    .string()
    .nullish()
    .transform((v) => v || null),
  situation: situationSchema,
  observations: z
    .array(z.unknown())
    .nullish()
    .transform((a) => (a ?? []).flatMap((x) => { const r = observationSchema.safeParse(x); return r.success ? [r.data] : []; }).slice(0, 3)),
});

const ASK_SYSTEM = `${MENTOR_PERSONA}

This is the general "Ask anything" chat (not tied to one skill). You are the person's overall UnfoldAI mentor — use the "general" mentor voice, not a specific skill teacher.
- Answer what they actually asked, using their skills, stages, known weaknesses, active tasks and situations from the context. Be specific: exact words to say, a concrete next step.
- If it's clearly about one of their skills, set skill to that skill's slug; otherwise null. If a real task would help, suggest opening that skill on Home — don't design tasks here.
- Unrelated questions are fine to answer briefly; then connect back to their development if it's natural.
- Don't do their work for them (essays, assignments); help them do it.
- situation: if they describe a real situation they're in, extract it (else null).
- observations: up to 3 new signs of a weakness ("blocker"), strength, pattern or preference with their exact words as quote and the subskill key (from that skill's subskills) if one fits.

Return JSON: {"reply": string, "skill": string|null, "situation": object|null, "observations": [{"kind","label","subskill","quote","situation","temporary"}]}`;

/** Answers a question with full context of the person's skills, tasks and patterns. */
export async function askMentor(user: UserLite, challengeId: string | null, question: string) {
  const usedToday = await db.mentorMessage.count({ where: { userId: user.id, role: "user", createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (usedToday >= DAILY_MESSAGE_LIMIT) throw new MentorError("You've reached today's question limit. Your mentor will be back tomorrow.");

  const [profile, skills, active, situations, insights, history] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.userSkill.findMany({ where: { userId: user.id, isActive: true }, include: { skill: true } }),
    db.challenge.findMany({ where: { userId: user.id, status: "active" }, include: { skill: true }, take: 4 }),
    db.userSituation.findMany({ where: { userId: user.id }, orderBy: { lastSeenAt: "desc" }, take: 3 }),
    getInsights(user.id, null),
    getMentorMessages(user.id, challengeId),
  ]);
  const scores = await db.skillScore.findMany({ where: { userId: user.id, skillId: { in: skills.map((s) => s.skillId) } } });
  const scoreBy = new Map(scores.map((s) => [s.skillId, s]));

  const context = {
    person: { firstName: firstName(user.name), profession: profile?.occupation ?? null, goal: profile?.goals ?? null },
    skills: skills.map(({ skill }) => {
      const sc = scoreBy.get(skill.id);
      const score = sc ? (sc.evidenceCount > 0 ? sc.score : (sc.selfScore ?? sc.score)) : null;
      return { slug: skill.slug, name: skill.name, stage: score == null ? null : stageForScore(score).name, score: score == null ? null : Math.round(score), verified: (sc?.evidenceCount ?? 0) > 0, subskills: frameworkOf(skill).subskills.map((x) => x.key) };
    }),
    knownWeaknesses: insights.filter((i) => i.kind === "blocker").slice(0, 6).map((i) => ({ text: i.text, skill: i.subskill, status: i.status })),
    knownStrengths: insights.filter((i) => i.kind === "strength").slice(0, 3).map((i) => i.text),
    activeTasks: active.map((a) => ({ skill: a.skill.name, title: a.title })),
    recentSituations: situations.map((s) => s.summary),
  };
  const recent = history.slice(-8).map((m) => ({ role: m.role === "user" ? "person" : "mentor", content: m.content.slice(0, 600) }));

  let out: z.infer<typeof askSchema>;
  try {
    out = (
      await generateStructured(askSchema, {
        system: ASK_SYSTEM,
        prompt: [userData("user_context", context), userData("user_recent_conversation", recent.length ? recent : "none"), userData("user_question", question), "Reply as their mentor."].join("\n\n"),
        temperature: 0.6,
        timeoutMs: 60_000,
      })
    ).data;
  } catch (e) {
    console.warn("[mentor-chat] AI failed:", (e as Error).message);
    throw new MentorError("Your mentor couldn't answer right now (the AI service is busy). Please try again in a minute.");
  }

  const rows = await db.$transaction([
    db.mentorMessage.create({ data: { userId: user.id, challengeId, role: "user", content: question } }),
    db.mentorMessage.create({ data: { userId: user.id, challengeId, role: "mentor", content: out.reply } }),
  ]);

  // Memory: only what they actually said, attached to the right skill when it's clear.
  const skill = skills.find((s) => s.skill.slug === out.skill)?.skill ?? null;
  if (out.situation) await saveSituation(user.id, skill?.id ?? null, null, out.situation);
  const subs = skill ? frameworkOf(skill).subskills : [];
  await recordObservations(user.id, skill?.id ?? null, groundObservations(out.observations, question, subs), { source: "message", refId: rows[0].id });
  return out.reply;
}
