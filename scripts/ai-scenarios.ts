// Real-AI scenario tests for the UnfoldAI intelligence engine.
// Runs the actual services against the dev database with throwaway users
// (deleted at the end) and the configured AI providers.
//
//   node --env-file=.env --import tsx scripts/ai-scenarios.ts            (all scenarios)
//   node --env-file=.env --import tsx scripts/ai-scenarios.ts 4 5        (only some)
//   AI_DOWN=1 node --env-file=.env --import tsx scripts/ai-scenarios.ts  (AI outage behaviour)

import { db } from "@/lib/db";
import { submitSelfAssessment } from "@/server/services/assessment";
import { abandonChallenge, analyzeFeedback, challengeAction, requestReview, saveFeedback, sendCoachMessage, startCoachSession } from "@/server/services/challenges";
import { getInsights } from "@/server/intelligence/evidence";

if (process.env.AI_DOWN) {
  process.env.GROQ_API_KEY = "invalid-key-for-outage-test";
  process.env.GEMINI_API_KEY = "invalid-key-for-outage-test";
  delete process.env.ANTHROPIC_API_KEY;
}

const only = process.argv.slice(2).map(Number).filter(Boolean);
const results: { scenario: string; check: string; ok: boolean; detail?: string }[] = [];
const log = (...a: unknown[]) => console.log(...a);
/** Pause like a real person (and stay inside the free tier's tokens-per-minute limit). */
const pace = () => new Promise((r) => setTimeout(r, Number(process.env.PACE_MS ?? 20000)));
const check = (scenario: string, label: string, ok: boolean, detail?: string) => {
  results.push({ scenario, check: label, ok, detail });
  log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};
const created: string[] = [];

async function makeUser(tag: string, scores: Record<string, number>, profile: { occupation?: string; goals?: string } = {}) {
  const user = await db.user.create({ data: { email: `scenario-${tag}-${Date.now()}@test.local`, name: `Test ${tag}`, timezone: "Asia/Kolkata" } });
  created.push(user.id);
  await db.userProfile.create({ data: { userId: user.id, onboardingDone: true, occupation: profile.occupation ?? "B.Tech student", goals: profile.goals ?? null } });
  const core = await db.skill.findMany({ where: { category: "core" } });
  const bySlug = Object.fromEntries(core.map((s) => [s.slug, s.id]));
  await submitSelfAssessment(user.id, Object.fromEntries(core.map((s) => [s.id, scores[s.slug] ?? 50])));
  return { user, skill: (slug: string) => bySlug[slug] };
}

async function lastCoach(convId: string, n = 1) {
  const m = await db.conversationMessage.findMany({ where: { conversationId: convId, role: "coach" }, orderBy: { createdAt: "desc" }, take: n });
  return m.reverse().map((x) => `[${x.kind}] ${x.content}`).join("\n    ");
}
async function proposed(convId: string) {
  return db.challenge.findFirst({ where: { conversationId: convId, status: "proposed" }, orderBy: { assignedAt: "desc" } });
}
async function say(userId: string, convId: string, text: string) {
  await pace();
  log(`    you: ${text}`);
  await sendCoachMessage(userId, convId, text);
  log(`    mentor: ${await lastCoach(convId)}`);
}
/** Talks until a task is proposed (asks for one if the mentor keeps exploring). */
async function untilTask(userId: string, convId: string, messages: string[]) {
  for (const m of messages) {
    await say(userId, convId, m);
    const p = await proposed(convId);
    if (p) return p;
  }
  await say(userId, convId, "Okay, give me a task for this.");
  return proposed(convId);
}
const taskText = (c: { title: string; instructions: string; steps: unknown; whyThisChallenge: string | null }) => `${c.title} ${c.instructions} ${JSON.stringify(c.steps)} ${c.whyThisChallenge}`.toLowerCase();
async function finishTask(userId: string, challengeId: string, status: "completed" | "partial" | "unsuccessful" | "not_attempted", answers: string[]) {
  await challengeAction(userId, challengeId, "accept");
  const ch = await db.challenge.findUniqueOrThrow({ where: { id: challengeId } });
  const qs = (Array.isArray(ch.feedbackQuestions) ? ch.feedbackQuestions : []) as string[];
  const reflection = await saveFeedback(userId, challengeId, { completionStatus: status, responses: answers.map((a, i) => ({ question: qs[i] ?? `Question ${i + 1}`, answer: a })) });
  // Like the app: if the AI is busy the evaluation stays pending and is retried on the next visit.
  for (let i = 0; i < 3; i++) {
    await pace();
    await analyzeFeedback(reflection.id);
    if (await db.aiAnalysis.findUnique({ where: { reflectionId: reflection.id } })) break;
    log("    (evaluation pending — AI busy, retrying like the app does)");
  }
  const ev = await db.skillScoreEvent.findFirst({ where: { userId, source: "challenge", sourceId: challengeId, subskill: "" } });
  const an = await db.aiAnalysis.findUnique({ where: { reflectionId: reflection.id } });
  log(`    evaluation: tier=${an?.tier} performance=${an?.performance} strength=${an?.evidenceStrength} delta=${ev?.delta}`);
  log(`    reason: ${ev?.reason}`);
  return { ev, an, reflection };
}

const scenarios: Record<number, [string, () => Promise<void>]> = {
  1: [
    "Confidence 20, struggles to approach strangers → supportive, tiny first task",
    async () => {
      const S = "S1";
      const { user, skill } = await makeUser("s1", { confidence: 20 });
      const { conversationId } = await startCoachSession(user.id, skill("confidence"), { fresh: true });
      log(`    mentor: ${await lastCoach(conversationId)}`);
      const task = await untilTask(user.id, conversationId, [
        "I want to be able to talk to new people at college. Right now I freeze and don't even go near them.",
        "I keep thinking they'll judge me or think I'm weird, so I just stay quiet with my phone.",
      ]);
      check(S, "a task was designed", !!task, task?.title);
      if (!task) return;
      log(`    task: ${task.title} (difficulty ${task.difficulty}) — ${task.whyThisChallenge}`);
      check(S, "difficulty fits Foundation stage (≤2)", task.difficulty <= 2, `difficulty ${task.difficulty}`);
      check(S, "explains why this task", (task.whyThisChallenge ?? "").length > 20);
      check(S, "tailored feedback questions generated", ((task.feedbackQuestions as string[]) ?? []).length >= 3);
      const ins = await getInsights(user.id, skill("confidence"));
      check(S, "weakness recorded with the user's own words as evidence", ins.some((i) => i.kind === "blocker" && i.evidence.length > 0), ins.map((i) => `${i.text} [${i.status}]`).join("; "));
      check(S, "single mention stays an early guess (not confirmed)", ins.every((i) => i.status !== "confirmed"));
    },
  ],
  2: [
    "Confidence 75 but public speaking is hard → targets the real weakness, not basics",
    async () => {
      const S = "S2";
      const { user, skill } = await makeUser("s2", { confidence: 75 });
      const { conversationId } = await startCoachSession(user.id, skill("confidence"), { fresh: true });
      const task = await untilTask(user.id, conversationId, [
        "One-on-one I'm totally fine and I make friends easily. But when I have to present to my class of 60, my mind goes blank after the first slide.",
        "Next week I have a 5-minute project presentation in front of the whole class and the professor.",
      ]);
      check(S, "a task was designed", !!task, task?.title);
      if (!task) return;
      const t = taskText(task);
      log(`    task: ${task.title} (difficulty ${task.difficulty})`);
      check(S, "difficulty fits Improving stage (≥3)", task.difficulty >= 3, `difficulty ${task.difficulty}`);
      check(S, "task is about presenting/speaking, not basic approaching", /present|slide|speak|audience|talk in front|class/.test(t) && !/say hi to a stranger|smile at/.test(t));
    },
  ],
  3: [
    "Same score (30), different weaknesses → different tasks",
    async () => {
      const S = "S3";
      const a = await makeUser("s3a", { confidence: 30 });
      const b = await makeUser("s3b", { confidence: 30 });
      const ca = await startCoachSession(a.user.id, a.skill("confidence"), { fresh: true });
      const cb = await startCoachSession(b.user.id, b.skill("confidence"), { fresh: true });
      const ta = await untilTask(a.user.id, ca.conversationId, ["I can't make myself walk up to people I don't know. I just stay in my corner at events and college."]);
      const tb = await untilTask(b.user.id, cb.conversationId, ["Approaching people is easy for me. My problem is group discussions — I have opinions but I never say them, I let others talk."]);
      check(S, "both got tasks", !!ta && !!tb);
      if (!ta || !tb) return;
      log(`    A: ${ta.title} [${ta.subskill}]  ·  B: ${tb.title} [${tb.subskill}]`);
      check(S, "different titles", ta.title !== tb.title);
      check(S, "different targets (subskill or content)", ta.subskill !== tb.subskill || !/opinion|group|discussion/.test(taskText(ta)), `${ta.subskill} vs ${tb.subskill}`);
      check(S, "B's task is about opinions/group discussion", /opinion|group|discussion|view|point/.test(taskText(tb)));
    },
  ],
  4: [
    "User describes a real environment → situation saved and task adapts to it",
    async () => {
      const S = "S4";
      const { user, skill } = await makeUser("s4", { communication: 35 });
      const { conversationId } = await startCoachSession(user.id, skill("communication"), { fresh: true });
      const task = await untilTask(user.id, conversationId, [
        "I'm sitting in my college canteen right now. At the next table there's a group of second-year students I don't know. I'd like to talk to them but I hesitate.",
      ]);
      const sit = await db.userSituation.findFirst({ where: { userId: user.id }, orderBy: { lastSeenAt: "desc" } });
      check(S, "situation extracted and saved", !!sit, sit?.summary);
      check(S, "location captured", /canteen|cafeteria/i.test(JSON.stringify(sit?.details ?? {}) + (sit?.summary ?? "")));
      check(S, "a task was designed", !!task, task?.title);
      if (task) check(S, "task uses the canteen / the students there", /canteen|cafeteria|table|second-year|students|group/.test(taskText(task)), task.title);
    },
  ],
  5: [
    "Attempts the task but it doesn't go well → analysed, never penalised",
    async () => {
      const S = "S5";
      const { user, skill } = await makeUser("s5", { confidence: 30 });
      const { conversationId } = await startCoachSession(user.id, skill("confidence"), { fresh: true });
      const task = await untilTask(user.id, conversationId, ["I want to start conversations with classmates but I always hesitate and wait for them to talk first."]);
      if (!task) return check(S, "task designed", false);
      const before = (await db.skillScore.findUniqueOrThrow({ where: { userId_skillId: { userId: user.id, skillId: skill("confidence") } } })).score;
      const { ev } = await finishTask(user.id, task.id, "unsuccessful", [
        "At lunch I walked up to two classmates from my lab and said 'hey, did you finish the assignment?'. One of them just said 'yeah' and turned back to his phone, so I left after a few seconds.",
        "Before going I was nervous and almost didn't go, I waited about five minutes.",
        "It felt awkward when he didn't continue. My face got hot.",
        "Next time I'd ask something that needs more than a yes/no answer.",
      ]);
      check(S, "score not decreased", (ev?.delta ?? 0) >= 0, `delta ${ev?.delta}`);
      check(S, "score within 0–0.5 for an unsuccessful attempt", (ev?.delta ?? 0) <= 0.5);
      const fb = await lastCoach(conversationId, 2);
      log(`    feedback: ${fb}`);
      check(S, "feedback refers to what actually happened", /walked|went up|approached|asked|assignment|yes|phone|lab/i.test(fb));
      const sc = await db.skillScore.findUniqueOrThrow({ where: { userId_skillId: { userId: user.id, skillId: skill("confidence") } } });
      check(S, "stored score never below previous", sc.score >= before);
    },
  ],
  6: [
    "Success → score rises only with specific evidence; vague report → no change",
    async () => {
      const S = "S6";
      const { user, skill } = await makeUser("s6", { communication: 40 });
      const { conversationId } = await startCoachSession(user.id, skill("communication"), { fresh: true });
      const t1 = await untilTask(user.id, conversationId, ["I want to get better at starting conversations with seniors in my department."]);
      if (!t1) return check(S, "task designed", false);
      const r1 = await finishTask(user.id, t1.id, "completed", [
        "After the robotics club meeting I went up to Rahul, a final-year senior, and said 'Hi, I'm in second year — how did you pick your final project?'. He talked for about five minutes about his drone project and asked what I'm interested in. I told him about my Arduino work and he suggested I join their Saturday sessions.",
        "I was nervous before — I rehearsed the first line twice in my head — but once he started answering it felt normal.",
        "The hardest part was walking over while he was packing up.",
        "It went better than expected: he gave me his number for the club group.",
        "Next time I'll ask a follow-up question about what he said instead of just nodding.",
      ]);
      check(S, "detailed success raised the score", (r1.ev?.delta ?? 0) > 0, `delta ${r1.ev?.delta}`);
      check(S, "rise within the policy bands (≤ +3)", (r1.ev?.delta ?? 0) <= 3);
      check(S, "explanation names what they did", /because/.test(r1.ev?.reason ?? ""), r1.ev?.reason ?? "");
      await sendCoachMessage(user.id, conversationId, "Give me my next task");
      const t2 = await proposed(conversationId);
      if (!t2) return check(S, "second task designed", false);
      const r2 = await finishTask(user.id, t2.id, "completed", ["I did it.", "It was good.", "Nothing really.", "Felt great!"]);
      check(S, "vague 'I did it' report → no change", (r2.ev?.delta ?? 1) === 0, `delta ${r2.ev?.delta}, strength ${r2.an?.evidenceStrength}`);
    },
  ],
  7: [
    "Repeated improvement → difficulty rises gradually (max one step at a time)",
    async () => {
      const S = "S7";
      const { user, skill } = await makeUser("s7", { confidence: 45 });
      const sid = skill("confidence");
      const { conversationId } = await startCoachSession(user.id, sid, { fresh: true });
      let task = await untilTask(user.id, conversationId, ["I want to speak up more in my team meetings at my internship."]);
      const diffs: number[] = [];
      const accounts = [
        "In Tuesday's standup I spoke first and gave my update in three sentences: what I finished (the login bug), what's next (tests), and that I'm blocked on API keys. My manager thanked me and assigned someone to help. I was nervous for the first sentence but then steady. I'd add a question next time.",
        "In the sprint planning I disagreed with estimating the search feature at 2 points. I said 'I think it's closer to 5 because we haven't handled pagination' and explained why. Two teammates agreed and we changed it to 5. My heart was racing but I kept my voice calm. Next time I'll suggest an alternative too.",
        "In the client demo I volunteered to present our module for ten minutes. I walked them through the dashboard, handled two questions about exporting data, and admitted one thing I didn't know and promised to follow up — which I did the same day by email. I felt confident most of the time.",
      ];
      for (const acc of accounts) {
        if (!task) break;
        diffs.push(task.difficulty);
        log(`    task: ${task.title} (difficulty ${task.difficulty})`);
        await finishTask(user.id, task.id, "completed", [acc]);
        await sendCoachMessage(user.id, conversationId, "Give me my next task");
        task = await proposed(conversationId);
      }
      if (task) diffs.push(task.difficulty);
      log(`    difficulty sequence: ${diffs.join(" → ")}`);
      check(S, "never jumps more than one level", diffs.every((d, i) => i === 0 || Math.abs(d - diffs[i - 1]) <= 1));
      check(S, "difficulty did not drop after successes", diffs.every((d, i) => i === 0 || d >= diffs[i - 1]));
      check(S, "difficulty increased at least once", diffs.length > 1 && diffs[diffs.length - 1] > diffs[0], diffs.join("→"));
    },
  ],
  8: [
    "Returns after several days → previous performance shapes the opening",
    async () => {
      const S = "S8";
      const { user, skill } = await makeUser("s8", { communication: 35 });
      const sid = skill("communication");
      const { conversationId } = await startCoachSession(user.id, sid, { fresh: true });
      const task = await untilTask(user.id, conversationId, ["Starting conversations is hard for me — I never know the first line to say to new classmates."]);
      if (!task) return check(S, "task designed", false);
      await finishTask(user.id, task.id, "completed", [
        "I asked Priya, who sits next to me in the DBMS class, 'Did you understand the normalization part?'. We talked for a few minutes about the professor and the assignment.",
        "Starting was easier than I thought because I had the question ready. But after the assignment topic I ran out of things to say and it got quiet, so I said bye.",
        "Next time I want to keep the conversation going longer.",
      ]);
      // Simulate 5 days passing.
      const past = new Date(Date.now() - 5 * 86_400_000);
      await db.conversation.updateMany({ where: { userId: user.id }, data: { updatedAt: past } });
      await db.challenge.updateMany({ where: { userId: user.id }, data: { completedAt: past } });
      const again = await startCoachSession(user.id, sid, { fresh: true });
      const opening = await lastCoach(again.conversationId);
      log(`    opening after 5 days: ${opening}`);
      check(S, "opening refers to the earlier task / continuing conversations", /priya|dbms|last time|keep(ing)? (the )?conversation|going|ran out|quiet|continu|follow-up|normaliz/i.test(opening));
      check(S, "doesn't restart the assessment from zero", !/what would you like to improve in communication\?/i.test(opening));
    },
  ],
  9: [
    "Good in one subskill, struggling in another → only exercised subskills change",
    async () => {
      const S = "S9";
      const { user, skill } = await makeUser("s9", { communication: 50 });
      const sid = skill("communication");
      const { conversationId } = await startCoachSession(user.id, sid, { fresh: true });
      const task = await untilTask(user.id, conversationId, ["I want to get better at asking good questions when I meet people. Listening is fine for me."]);
      if (!task) return check(S, "task designed", false);
      await finishTask(user.id, task.id, "completed", [
        "At the hackathon mixer I asked three people open questions: 'What problem are you trying to solve this weekend?', 'Why did you pick that?' and 'What would make it a win for you?'. Each conversation went 5+ minutes. One person said nobody had asked her that before.",
        "I prepared the questions on the bus. I was a bit nervous with the first person only.",
        "Next time I want to ask better follow-ups based on their answers.",
      ]);
      const subs = await db.subskillScore.findMany({ where: { userId: user.id, skillId: sid } });
      log(`    subskill scores: ${subs.map((s) => `${s.subskill}=${s.score}`).join(", ") || "none"}`);
      check(S, "at most two subskills touched", subs.length <= 2);
      check(S, "the exercised subskill (asking questions) is among them", subs.some((s) => /question/.test(s.subskill)) || subs.length === 0, subs.map((s) => s.subskill).join(","));
      check(S, "untested subskills not given scores", !subs.some((s) => /conflict|non-verbal/.test(s.subskill)));
    },
  ],
  10: [
    "Same feedback submitted twice / evaluated twice → no double points",
    async () => {
      const S = "S10";
      const { user, skill } = await makeUser("s10", { confidence: 40 });
      const sid = skill("confidence");
      const { conversationId } = await startCoachSession(user.id, sid, { fresh: true });
      const task = await untilTask(user.id, conversationId, ["I want to share my opinion in class discussions instead of staying silent."]);
      if (!task) return check(S, "task designed", false);
      await challengeAction(user.id, task.id, "accept");
      const input = { completionStatus: "completed" as const, responses: [{ question: "What happened?", answer: "In the economics tutorial I said I disagreed with the idea that minimum wage always reduces jobs and gave the Kerala example; the tutor asked me to explain more and two classmates responded." }] };
      const [a, b] = await Promise.allSettled([saveFeedback(user.id, task.id, input), saveFeedback(user.id, task.id, input)]);
      check(S, "only one of two simultaneous submissions accepted", [a, b].filter((x) => x.status === "fulfilled").length === 1);
      const refl = await db.reflection.findUniqueOrThrow({ where: { challengeId: task.id } });
      await Promise.allSettled([analyzeFeedback(refl.id), analyzeFeedback(refl.id)]);
      await analyzeFeedback(refl.id);
      const events = await db.skillScoreEvent.findMany({ where: { userId: user.id, source: "challenge", sourceId: task.id, subskill: "" } });
      const analyses = await db.aiAnalysis.count({ where: { reflectionId: refl.id } });
      check(S, "exactly one evaluation stored", analyses === 1, `${analyses}`);
      check(S, "exactly one score change recorded", events.length === 1, `${events.length}`);
      const sc = await db.skillScore.findUniqueOrThrow({ where: { userId_skillId: { userId: user.id, skillId: sid } } });
      check(S, "score equals baseline + the single change", Math.abs(sc.score - (events[0].previousScore! + events[0].delta)) < 0.01, `${sc.score}`);
      // Review: once only, and never on someone else's task.
      const other = await makeUser("s10b", { confidence: 40 });
      await requestReview(other.user.id, task.id, "Please look again, I explained my point in detail.").then(
        () => check(S, "another user can't request a review of this task", false),
        () => check(S, "another user can't request a review of this task", true),
      );
      await requestReview(user.id, task.id, "I also stayed after class and continued the debate with the tutor for ten minutes.").catch((e) => log(`    review: ${(e as Error).message}`));
      await requestReview(user.id, task.id, "Another review please, I want more points.").then(
        () => check(S, "a second review is refused", false),
        () => check(S, "a second review is refused", true),
      );
      const all = await db.skillScoreEvent.findMany({ where: { userId: user.id, sourceId: task.id, subskill: "" } });
      log(`    events: ${all.map((e) => `${e.source}:${e.delta}`).join(", ")}`);
      // Abandoning is never penalised.
      const conv2 = await startCoachSession(user.id, sid, { fresh: true });
      const t2 = await untilTask(user.id, conv2.conversationId, ["Give me a quick task for speaking up."]);
      if (t2) {
        await challengeAction(user.id, t2.id, "accept");
        const before = (await db.skillScore.findUniqueOrThrow({ where: { userId_skillId: { userId: user.id, skillId: sid } } })).score;
        await abandonChallenge(user.id, t2.id);
        const after = (await db.skillScore.findUniqueOrThrow({ where: { userId_skillId: { userId: user.id, skillId: sid } } })).score;
        check(S, "setting a task aside doesn't change the score", before === after);
      }
    },
  ],
};

async function outage() {
  const S = "AI outage";
  log(`\n▶ ${S}: no provider reachable`);
  const { user, skill } = await makeUser("down", { confidence: 30 });
  const { conversationId } = await startCoachSession(user.id, skill("confidence"), { fresh: true });
  const before = await db.conversationMessage.count({ where: { conversationId } });
  const err = await sendCoachMessage(user.id, conversationId, "I hesitate a lot before talking to people").then(() => null, (e: Error) => e.message);
  const after = await db.conversationMessage.count({ where: { conversationId } });
  check(S, "user is told the mentor couldn't reply (no scripted answer)", !!err && /couldn't reply/.test(err), err ?? "no error");
  check(S, "unanswered message removed so it can be resent", after === before);
  check(S, "no task invented", (await db.challenge.count({ where: { userId: user.id } })) === 0);
}

async function main() {
  try {
    if (process.env.AI_DOWN) await outage();
    else
      for (const [n, [name, fn]] of Object.entries(scenarios)) {
        if (only.length && !only.includes(Number(n))) continue;
        log(`\n▶ Scenario ${n}: ${name}`);
        try {
          await fn();
        } catch (e) {
          check(`S${n}`, "ran without errors", false, (e as Error).message);
        }
      }
  } finally {
    for (const id of created) {
      await db.challenge.deleteMany({ where: { userId: id } });
      await db.conversation.deleteMany({ where: { userId: id } });
      await db.skillScoreEvent.deleteMany({ where: { userId: id } });
      await db.subskillScore.deleteMany({ where: { userId: id } });
      await db.skillScore.deleteMany({ where: { userId: id } });
      await db.assessmentAnswer.deleteMany({ where: { assessment: { userId: id } } });
      await db.userInsight.deleteMany({ where: { userId: id } });
      await db.userSkill.deleteMany({ where: { userId: id } });
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  }
  const failed = results.filter((r) => !r.ok);
  log(`\nRESULT ${results.length - failed.length}/${results.length} checks passed`);
  for (const f of failed) log(`  FAILED [${f.scenario}] ${f.check}${f.detail ? ` — ${f.detail}` : ""}`);
  await db.$disconnect();
}
main();
