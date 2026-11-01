"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession, requireUser } from "@/server/auth/session";
import { getAssessmentSkills, submitInitialAssessment } from "@/server/services/assessment";
import { setUserSkills } from "@/server/services/skills";
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

const signupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  timezone: z.string().max(64).optional(),
});

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, timezone } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) {
    return { error: "An account with this email already exists" };
  }
  const user = await db.user.create({
    data: { name, email, passwordHash: await hashPassword(password), timezone: timezone || "UTC" },
  });
  await createSession(user.id);
  redirect("/onboarding");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(1, "Please enter your password"),
});

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Incorrect email or password" };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

// ─── Onboarding & skills ──────────────────────────────────────────────────

const onboardingSchema = z.object({
  occupation: z.string().trim().max(120).optional(),
  goals: z.string().trim().max(600).optional(),
});

export async function onboardingAction(form: FormData) {
  const user = await requireUser();
  const { occupation, goals } = onboardingSchema.parse({
    occupation: form.get("occupation") ?? undefined,
    goals: form.get("goals") ?? undefined,
  });
  const specific = form.getAll("specific").map(String);

  await db.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, occupation, goals, onboardingDone: true },
    update: { occupation, goals, onboardingDone: true },
  });
  await setUserSkills(user.id, specific);
  redirect("/assessment");
}

export async function updateSkillsAction(form: FormData) {
  const user = await requireUser();
  await setUserSkills(user.id, form.getAll("specific").map(String));
  revalidatePath("/dashboard");
  redirect("/dashboard?skills=updated");
}

// ─── Assessment ───────────────────────────────────────────────────────────

export async function assessmentAction(form: FormData) {
  const user = await requireUser();
  const skills = await getAssessmentSkills(user.id);
  const levels: Record<string, number> = {};
  for (const s of skills) {
    const v = Number(form.get(s.id));
    if (Number.isInteger(v) && v >= 1 && v <= 5) levels[s.id] = v;
  }
  await submitInitialAssessment(user.id, levels);
  redirect("/dashboard?welcome=1");
}

// ─── Sessions: choose skill + situation → practical steps ────────────────

const startSchema = z.object({
  skillId: z.string().min(1, "Choose the skill you want to work on"),
  situation: z
    .string()
    .trim()
    .min(15, "Describe your situation in a bit more detail (15+ characters)")
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

const reflectionSchema = z.object({
  challengeId: z.string().min(1),
  completed: z.enum(["yes", "no"]),
  selfRating: z.coerce.number().int().min(1).max(5),
  perceivedDifficulty: z.coerce.number().int().min(1).max(5),
  whatHappened: z.string().trim().min(10, "Tell us a little more about what happened (10+ characters)").max(2000),
  whatWasHard: z.string().trim().max(1500).optional(),
  whatLearned: z.string().trim().max(1500).optional(),
});

export async function reflectionAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = reflectionSchema.safeParse(Object.fromEntries(form));
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
  revalidatePath(parsed.data.challengeId ? `/challenge/${parsed.data.challengeId}` : "/dashboard");
  return {};
}
