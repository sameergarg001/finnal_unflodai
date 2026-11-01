import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { ensureCoreSkills } from "@/server/services/skills";

const COOKIE = "ufa_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string) {
  await ensureCoreSkills(userId);
  // Housekeeping: drop this user's expired sessions.
  await db.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.session.create({ data: { userId, tokenHash: sha256(token), expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

/** Current user (or null). Cached per request. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { profile: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/welcome");
  return user;
}

/** Where a signed-in user should be sent next during onboarding (null = ready). */
export function onboardingPath(user: { profile: { onboardingDone: boolean; assessmentDone: boolean } | null }): string | null {
  if (!user.profile?.onboardingDone) return "/onboarding/profile";
  if (!user.profile.assessmentDone) return "/onboarding/assessment";
  return null;
}

/** Requires a logged-in user who finished profile setup and the core skill self-assessment. */
export async function requireReadyUser() {
  const user = await requireUser();
  const next = onboardingPath(user);
  if (next) redirect(next);
  return user;
}

/** Signs out everywhere: removes all sessions of this user. */
export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
  (await cookies()).delete(COOKIE);
}
