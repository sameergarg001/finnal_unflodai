import { db } from "@/lib/db";
import { generateText } from "@/ai/client";
import { CHAT_SYSTEM, chatPrompt } from "@/ai/mentorPrompts";
import { levelForScore } from "../assessment/levels";
import { recallInsights } from "../engine/memory";

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const firstName = (name: string | null | undefined) => (name ?? "there").trim().split(/\s+/)[0] || "there";

type UserLite = { id: string; name: string | null; timezone: string };

// ─── Ask your mentor ──────────────────────────────────────────────────────

const DAILY_MESSAGE_LIMIT = 30;

export async function getMentorMessages(userId: string, challengeId: string | null) {
  const rows = await db.mentorMessage.findMany({
    where: { userId, challengeId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.reverse();
}

export class MentorError extends Error {}

/** Answers a question with full context of the user's step, situation and patterns. */
export async function askMentor(user: UserLite, challengeId: string | null, question: string) {
  // Protects the free AI quota: max questions per rolling 24 hours.
  const usedToday = await db.mentorMessage.count({
    where: { userId: user.id, role: "user", createdAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (usedToday >= DAILY_MESSAGE_LIMIT) throw new MentorError("You've reached today's question limit. Your mentor will be back tomorrow.");

  const step = challengeId
    ? await db.challenge.findFirst({
        where: { id: challengeId, userId: user.id },
        include: { skill: true, reflection: { include: { analysis: true } } },
      })
    : await db.challenge.findFirst({
        where: { userId: user.id, status: { in: ["active", "done", "abandoned"] } },
        include: { skill: true, reflection: { include: { analysis: true } } },
        orderBy: { assignedAt: "desc" },
      });
  if (challengeId && !step) throw new MentorError("Step not found");

  const score = step
    ? await db.skillScore.findUnique({ where: { userId_skillId: { userId: user.id, skillId: step.skillId } } })
    : null;
  const history = (await getMentorMessages(user.id, challengeId)).slice(-8).map((m) => ({ role: m.role, content: m.content }));

  const context = {
    firstName: firstName(user.name),
    step: step
      ? {
          skill: step.skill.name,
          level: score ? levelForScore(score.score).name : undefined,
          situation: step.situation,
          title: step.title,
          instructions: step.instructions,
          status: step.status,
          feedback: step.reflection?.whatHappened,
          painPoints: asStrings(step.reflection?.analysis?.painPoints),
        }
      : null,
    patterns: (await recallInsights(user.id, step?.skillId ?? "", 4)).map(({ kind, text }) => ({ kind, text })),
  };

  let answer: string;
  try {
    const res = await generateText({ system: CHAT_SYSTEM, prompt: chatPrompt({ context, history, question }), temperature: 0.6, timeoutMs: 60_000 });
    answer = res.text.slice(0, 2000);
  } catch (e) {
    console.warn("[mentor-chat] AI failed:", (e as Error).message);
    throw new MentorError("Your mentor couldn't answer right now (the AI service is busy). Please try again in a minute.");
  }

  await db.mentorMessage.createMany({
    data: [
      { userId: user.id, challengeId, role: "user", content: question },
      { userId: user.id, challengeId, role: "mentor", content: answer },
    ],
  });
  return answer;
}

