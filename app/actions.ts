"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession, requireUser } from "@/server/auth/session";
import { setSelfLevels } from "@/server/services/assessment";
import { ensureUserSetup, setUserSkills } from "@/server/services/skills";
import {
  SessionError,
  continueSession,
  analyzeFeedback,
  saveFeedback,
  skipChallenge,
  startSession,
} from "@/server/services/challenges";
import { MentorError, askMentor } from "@/server/services/mentor";

export type FormState = { error?: string } | undefined;

// ─── Auth ─────────────────────────────────────────────────────────────────

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(1, "Please enter your password").max(200),
  timezone: z.string().max(64).optional(),
});

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, timezone } = parsed.data;
  if (password.length < 8) return { error: "Password needs at least 8 characters" };

  if (await db.user.findUnique({ where: { email } })) {
    return { error: "This email already has an account — log in instead" };
  }
  const user = await db.user.create({
    data: { email, passwordHash: await hashPassword(password), timezone: timezone || "UTC" },
  });
  await ensureUserSetup(user.id);
  await createSession(user.id);
  redirect("/dashboard");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Incorrect email or password" };
  }
  if (parsed.data.timezone && parsed.data.timezone !== user.timezone) {
    await db.user.update({ where: { id: user.id }, data: { timezone: parsed.data.timezone } });
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ─── "Me" — all optional ──────────────────────────────────────────────────

export async function updateSkillsAction(form: FormData) {
  const user = await requireUser();
  await setUserSkills(user.id, form.getAll("specific").map(String));
  revalidatePath("/me");
  redirect("/me?saved=skills");
}

export async function updateLevelsAction(form: FormData) {
  const user = await requireUser();
  const levels: Record<string, number> = {};
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("level:")) continue;
    const n = Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= 5) levels[k.slice(6)] = n;
  }
  await setSelfLevels(user.id, levels);
  revalidatePath("/me");
  redirect("/me?saved=levels");
}

const aboutSchema = z.object({
  name: z.string().trim().max(80).optional(),
  occupation: z.string().trim().max(120).optional(),
  goals: z.string().trim().max(600).optional(),
});

export async function updateAboutAction(form: FormData) {
  const user = await requireUser();
  const d = aboutSchema.parse({
    name: form.get("name") ?? undefined,
    occupation: form.get("occupation") ?? undefined,
    goals: form.get("goals") ?? undefined,
  });
  await db.user.update({ where: { id: user.id }, data: { name: d.name || null } });
  await db.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, occupation: d.occupation || null, goals: d.goals || null, onboardingDone: true },
    update: { occupation: d.occupation || null, goals: d.goals || null },
  });
  revalidatePath("/me");
  redirect("/me?saved=about");
}

// ─── Sessions: choose skill + situation → practical steps ────────────────

const startSchema = z.object({
  skillId: z.string().min(1, "Choose the skill you want to work on"),
  situation: z
    .string()
    .trim()
    .min(5, "Tell your mentor a bit about what's going on")
    .max(2000),
});

export async function startSessionAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = startSchema.safeParse({ skillId: form.get("skillId") ?? "", situation: form.get("situation") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let id: string;
  try {
    id = (await startSession(user.id, parsed.data.skillId, parsed.data.situation)).id;
  } catch (e) {
    if (e instanceof SessionError) return { error: e.message };
    throw e;
  }
  redirect(`/challenge/${id}`);
}

export async function nextStepAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const previousId = String(form.get("previousId") ?? "");
  const update = String(form.get("update") ?? "").slice(0, 1000);
  let id: string;
  try {
    id = (await continueSession(user.id, previousId, update)).id;
  } catch (e) {
    if (e instanceof SessionError) return { error: e.message };
    throw e;
  }
  redirect(`/challenge/${id}`);
}

// ─── Steps: skip & feedback ───────────────────────────────────────────────

export async function skipChallengeAction(form: FormData) {
  const user = await requireUser();
  await skipChallenge(user.id, String(form.get("challengeId")));
  redirect("/dashboard");
}

// Only "did it?" and a short note are required; ratings are optional (default: middle).
const optionalRating = z.preprocess((v) => (v === "" || v == null ? 3 : v), z.coerce.number().int().min(1).max(5));
const reflectionSchema = z.object({
  challengeId: z.string().min(1),
  completed: z.enum(["yes", "no"], { message: "Tap \"Did it\" or \"Didn't manage\"" }),
  selfRating: optionalRating,
  perceivedDifficulty: optionalRating,
  whatHappened: z.string().trim().min(3, "Write a few words about how it went").max(2000),
  whatWasHard: z.string().trim().max(1500).optional(),
  whatLearned: z.string().trim().max(1500).optional(),
});

export async function reflectionAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = reflectionSchema.safeParse({
    challengeId: form.get("challengeId"),
    completed: form.get("completed") ?? undefined,
    selfRating: form.get("selfRating"),
    perceivedDifficulty: form.get("perceivedDifficulty"),
    whatHappened: form.get("whatHappened") ?? "",
    whatWasHard: form.get("whatWasHard") || undefined,
    whatLearned: form.get("whatLearned") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { challengeId, completed, ...rest } = parsed.data;

  let reflectionId: string;
  try {
    reflectionId = (await saveFeedback(user.id, challengeId, { ...rest, completed: completed === "yes" })).id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  // Feedback is saved instantly; the mentor analyses it in the background
  // (the AI can be slow) and the step page updates when it's ready.
  after(() => analyzeFeedback(reflectionId));
  revalidatePath("/dashboard");
  redirect(`/challenge/${challengeId}`);
}

// ─── Ask your mentor ──────────────────────────────────────────────────────

const askSchema = z.object({
  question: z.string().trim().min(2, "Type your question").max(1000),
  challengeId: z.string().optional(),
});

export async function askMentorAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = askSchema.safeParse({
    question: form.get("question") ?? "",
    challengeId: form.get("challengeId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await askMentor(user, parsed.data.challengeId ?? null, parsed.data.question);
  } catch (e) {
    if (e instanceof MentorError) return { error: e.message };
    throw e;
  }
  revalidatePath(parsed.data.challengeId ? `/challenge/${parsed.data.challengeId}` : "/mentor");
  return {};
}
