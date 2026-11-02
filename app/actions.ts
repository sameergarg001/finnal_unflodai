"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { safeTimeZone } from "@/lib/time";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroyAllSessions, destroySession, onboardingPath, requireUser } from "@/server/auth/session";
import { submitSelfAssessment } from "@/server/services/assessment";
import { SkillError, addCatalogSkill, addSkillByName, removeSkill, setSelfScore } from "@/server/services/skills";
import {
  CoachError,
  abandonChallenge,
  analyzeFeedback,
  challengeAction,
  nextChallenge,
  saveFeedback,
  sendCoachMessage,
  startCoachSession,
  type ChallengeAction,
} from "@/server/services/challenges";
import { MentorError, askMentor } from "@/server/services/mentor";
import { preferencesOf } from "@/server/services/notifications";

export type FormState = { error?: string; ok?: string } | undefined;

const known = (e: unknown) => e instanceof CoachError || e instanceof SkillError || e instanceof MentorError;
async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

// ─── Auth (email & password — the "Sign in" option next to Google) ────────

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(1, "Please enter your password").max(200),
  timezone: z.string().max(64).optional(),
});

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  if (!rateLimit(`signup:${await clientIp()}`, 10, 3600_000)) return { error: "Too many attempts. Try again later." };
  const parsed = credentialsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, timezone } = parsed.data;
  if (password.length < 8) return { error: "Password needs at least 8 characters" };
  if (await db.user.findUnique({ where: { email } })) return { error: "This email already has an account — sign in instead" };
  const user = await db.user.create({
    data: { email, passwordHash: await hashPassword(password), timezone: safeTimeZone(timezone) },
  });
  await createSession(user.id);
  redirect("/onboarding/profile");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!rateLimit(`login:${parsed.data.email}`, 8, 15 * 60_000) || !rateLimit(`login-ip:${await clientIp()}`, 30, 15 * 60_000)) {
    return { error: "Too many attempts. Please wait 15 minutes." };
  }
  const user = await db.user.findUnique({ where: { email: parsed.data.email }, include: { profile: true } });
  if (!user?.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: user && !user.passwordHash ? "This account uses Google — tap “Continue with Google”" : "Incorrect email or password" };
  }
  if (parsed.data.timezone && parsed.data.timezone !== user.timezone) {
    await db.user.update({ where: { id: user.id }, data: { timezone: safeTimeZone(parsed.data.timezone) } });
  }
  await createSession(user.id);
  redirect(onboardingPath(user) ?? "/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/welcome");
}

// ─── Onboarding ───────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().trim().max(80).optional(),
  age: z
    .preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int("Age must be a whole number").min(10, "Age must be 10 or more").max(120).optional()),
  profession: z.string().trim().max(120).optional(),
  goal: z.string().trim().max(600).optional(),
  about: z.string().trim().max(1000).optional(),
});

async function saveProfile(userId: string, form: FormData) {
  const parsed = profileSchema.safeParse({
    name: form.get("name") ?? undefined,
    age: form.get("age") ?? undefined,
    profession: form.get("profession") ?? undefined,
    goal: form.get("goal") ?? undefined,
    about: form.get("about") ?? undefined,
  });
  if (!parsed.success) return parsed.error.issues[0].message;
  const d = parsed.data;
  await db.user.update({ where: { id: userId }, data: { name: d.name || null, age: d.age ?? null } });
  await db.userProfile.upsert({
    where: { userId },
    create: { userId, occupation: d.profession || null, goals: d.goal || null, about: d.about || null, onboardingDone: true },
    update: { occupation: d.profession || null, goals: d.goal || null, about: d.about || null, onboardingDone: true },
  });
  return null;
}

export async function onboardingProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (form.get("skip") === "1") {
    await db.userProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, onboardingDone: true }, update: { onboardingDone: true } });
  } else {
    const error = await saveProfile(user.id, form);
    if (error) return { error };
  }
  redirect("/onboarding/assessment");
}

function readScores(form: FormData): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("score:")) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n <= 100) scores[k.slice(6)] = n;
  }
  return scores;
}

export async function assessmentAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  try {
    await submitSelfAssessment(user.id, readScores(form));
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/dashboard");
  redirect(form.get("from") === "profile" ? "/profile?saved=assessment" : "/dashboard?welcome=1");
}

// ─── Profile & settings ───────────────────────────────────────────────────

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const error = await saveProfile(user.id, form);
  if (error) return { error };
  revalidatePath("/profile");
  return { ok: "Profile saved" };
}

export async function updatePreferencesAction(form: FormData) {
  const user = await requireUser();
  const current = preferencesOf(user.profile?.preferences);
  const prefs = {
    theme: form.get("theme") === "light" ? "light" : form.get("theme") === "dark" ? "dark" : current.theme,
    notifications: form.has("notifications")
      ? {
          activeChallenge: form.get("n_active") === "on",
          feedback: form.get("n_feedback") === "on",
          reports: form.get("n_reports") === "on",
          inactiveSkill: form.get("n_inactive") === "on",
        }
      : current.notifications,
  };
  await db.userProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, preferences: prefs }, update: { preferences: prefs } });
  revalidatePath("/", "layout");
  redirect("/profile?saved=preferences");
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8 || next.length > 200) return { error: "New password needs at least 8 characters" };
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (full.passwordHash && !(await verifyPassword(current, full.passwordHash))) return { error: "Current password is incorrect" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  // Sign out other devices, keep this one.
  await destroyAllSessions(user.id);
  await createSession(user.id);
  return { ok: full.passwordHash ? "Password changed. Other devices were signed out." : "Password set — you can now also sign in with email." };
}

export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm" };
  // Delete dependent rows explicitly (custom skills are referenced by challenges).
  await db.$transaction([
    db.challenge.deleteMany({ where: { userId: user.id } }),
    db.conversation.deleteMany({ where: { userId: user.id } }),
    db.skillScoreEvent.deleteMany({ where: { userId: user.id } }),
    db.skillScore.deleteMany({ where: { userId: user.id } }),
    db.assessmentAnswer.deleteMany({ where: { assessment: { userId: user.id } } }),
    db.userInsight.deleteMany({ where: { userId: user.id } }),
    db.userSkill.deleteMany({ where: { userId: user.id } }),
    db.user.delete({ where: { id: user.id } }),
  ]);
  await db.skill.deleteMany({ where: { ownerId: user.id } });
  (await cookies()).delete("ufa_session");
  redirect("/welcome?deleted=1");
}

export async function markNotificationsSeenAction() {
  const user = await requireUser();
  await db.userProfile.update({ where: { userId: user.id }, data: { notificationsSeenAt: new Date() } });
  revalidatePath("/", "layout");
}

// ─── Skills ───────────────────────────────────────────────────────────────

const optionalScore = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).max(100).nullable());

export async function addSkillAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const selfScore = optionalScore.parse(form.get("selfScore"));
  let skillId: string;
  try {
    const skillIdIn = String(form.get("skillId") ?? "");
    if (skillIdIn) {
      skillId = (await addCatalogSkill(user.id, skillIdIn, selfScore)).id;
    } else {
      const subskills = String(form.get("subskills") ?? "").split(/[,\n]/);
      skillId = (await addSkillByName(user.id, String(form.get("name") ?? ""), subskills, selfScore)).id;
    }
  } catch (e) {
    if (known(e)) return { error: (e as Error).message };
    throw e;
  }
  revalidatePath("/dashboard");
  redirect(`/skills/${skillId}?added=1`);
}

export async function removeSkillAction(form: FormData) {
  const user = await requireUser();
  await removeSkill(user.id, String(form.get("skillId")));
  revalidatePath("/dashboard");
  redirect("/profile?saved=skills");
}

export async function updateSelfScoreAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const skillId = String(form.get("skillId") ?? "");
  const score = optionalScore.parse(form.get("selfScore"));
  if (score == null) return { error: "Choose a score" };
  const us = await db.userSkill.findUnique({ where: { userId_skillId: { userId: user.id, skillId } } });
  if (!us) return { error: "Skill not found" };
  await setSelfScore(user.id, skillId, score, "Updated self-assessment");
  revalidatePath(`/skills/${skillId}`);
  return { ok: "Self-assessment updated" };
}

// ─── AI coach ─────────────────────────────────────────────────────────────

export async function startCoachAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const skillId = String(form.get("skillId") ?? "");
  const message = String(form.get("message") ?? "").trim() || undefined;
  let res;
  try {
    res = await startCoachSession(user.id, skillId, { fresh: form.get("fresh") === "1", firstMessage: message });
  } catch (e) {
    if (known(e)) return { error: (e as Error).message };
    throw e;
  }
  redirect(res.activeChallengeId && !message ? `/challenge/${res.activeChallengeId}` : `/coach/${res.conversationId}`);
}

/** Re-runs the first-time interview for a skill (e.g. goals changed). History is kept. */
export async function redoInterviewAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const skillId = String(form.get("skillId") ?? "");
  const active = await db.challenge.findFirst({ where: { userId: user.id, skillId, status: "active" } });
  if (active) return { error: "Finish or abandon your active task first." };
  let res;
  try {
    res = await startCoachSession(user.id, skillId, { fresh: true, interview: true });
  } catch (e) {
    if (known(e)) return { error: (e as Error).message };
    throw e;
  }
  redirect(`/coach/${res.conversationId}`);
}

export async function coachMessageAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const conversationId = String(form.get("conversationId") ?? "");
  try {
    await sendCoachMessage(user.id, conversationId, String(form.get("message") ?? ""));
  } catch (e) {
    if (known(e)) return { error: (e as Error).message };
    throw e;
  }
  revalidatePath(`/coach/${conversationId}`);
  return { ok: "sent" };
}

const ACTIONS = ["accept", "another", "easier", "explain"] as const;

export async function challengeActionAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const action = String(form.get("action")) as ChallengeAction;
  if (!ACTIONS.includes(action as (typeof ACTIONS)[number])) return { error: "Unknown action" };
  const challengeId = String(form.get("challengeId") ?? "");
  let ch;
  try {
    ch = await challengeAction(user.id, challengeId, action);
  } catch (e) {
    if (known(e)) return { error: (e as Error).message };
    throw e;
  }
  if (action === "accept") redirect(`/challenge/${challengeId}?accepted=1`);
  revalidatePath(`/coach/${ch?.conversationId}`);
  return { ok: "done" };
}

export async function abandonChallengeAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const challengeId = String(form.get("challengeId") ?? "");
  const ch = await db.challenge.findFirst({ where: { id: challengeId, userId: user.id } });
  try {
    await abandonChallenge(user.id, challengeId);
  } catch (e) {
    if (known(e)) return { error: (e as Error).message };
    throw e;
  }
  redirect(ch?.conversationId ? `/coach/${ch.conversationId}` : "/dashboard");
}

const feedbackSchema = z.object({
  challengeId: z.string().min(1),
  completionStatus: z.enum(["completed", "partial", "unsuccessful", "not_attempted"], { message: "Choose how it went" }),
  responses: z
    .array(z.object({ question: z.string().max(300), answer: z.string().max(3000) }))
    .max(10),
});

export async function feedbackAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  let responses: unknown = [];
  try {
    responses = JSON.parse(String(form.get("responses") ?? "[]"));
  } catch {}
  const parsed = feedbackSchema.safeParse({ challengeId: form.get("challengeId"), completionStatus: form.get("completionStatus"), responses });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let reflectionId: string;
  try {
    reflectionId = (await saveFeedback(user.id, parsed.data.challengeId, parsed.data)).id;
  } catch (e) {
    if (known(e)) return { error: (e as Error).message };
    throw e;
  }
  // Saved instantly; the coach analyses in the background and the page updates when ready.
  after(() => analyzeFeedback(reflectionId));
  revalidatePath("/dashboard");
  redirect(`/challenge/${parsed.data.challengeId}`);
}

export async function nextChallengeAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  let res;
  try {
    res = await nextChallenge(user.id, String(form.get("challengeId") ?? ""));
  } catch (e) {
    if (known(e)) return { error: (e as Error).message };
    throw e;
  }
  redirect(`/coach/${res.conversationId}`);
}

// ─── General coach chat (Coach tab) ───────────────────────────────────────

const askSchema = z.object({
  question: z.string().trim().min(2, "Type your question").max(1000),
  challengeId: z.string().optional(),
});

export async function askMentorAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = askSchema.safeParse({ question: form.get("question") ?? "", challengeId: form.get("challengeId") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!rateLimit(`ai:${user.id}`, 60, 3600_000)) return { error: "You're going fast! Please wait a few minutes." };
  try {
    await askMentor(user, parsed.data.challengeId ?? null, parsed.data.question);
  } catch (e) {
    if (e instanceof MentorError) return { error: e.message };
    throw e;
  }
  revalidatePath("/mentor");
  return {};
}
