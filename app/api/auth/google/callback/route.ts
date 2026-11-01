import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { GOOGLE_STATE_COOKIE, appUrl, exchangeCodeForProfile, googleConfigured } from "@/server/auth/google";
import { createSession, onboardingPath } from "@/server/auth/session";
import { safeTimeZone } from "@/lib/time";

/** Google redirects here after consent. Verifies state, signs the user in (creating the account if new). */
export async function GET(req: NextRequest) {
  const base = appUrl(req.nextUrl.origin);
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${base}/welcome?error=${code}`);
    res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
    return res;
  };
  if (!googleConfigured()) return fail("google_not_configured");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  let saved: { state?: string; tz?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? "{}");
  } catch {}
  if (req.nextUrl.searchParams.get("error")) return fail("google_cancelled");
  if (!code || !state || !saved.state || state !== saved.state) return fail("google_state");

  let profile;
  try {
    profile = await exchangeCodeForProfile(base, code);
  } catch (e) {
    console.warn("[google]", (e as Error).message);
    return fail("google_failed");
  }
  if (!profile.email_verified) return fail("google_unverified");

  const timezone = saved.tz ? safeTimeZone(saved.tz) : undefined;
  let user = await db.user.findUnique({ where: { googleId: profile.sub } });
  if (!user) {
    // Link to an existing email account (Google verified the address), or create a new one.
    const byEmail = await db.user.findUnique({ where: { email: profile.email } });
    user = byEmail
      ? await db.user.update({
          where: { id: byEmail.id },
          data: { googleId: profile.sub, image: byEmail.image ?? profile.picture, name: byEmail.name ?? profile.name },
        })
      : await db.user.create({
          data: { email: profile.email, googleId: profile.sub, name: profile.name, image: profile.picture, timezone: timezone ?? "UTC" },
        });
  } else if (profile.picture && user.image !== profile.picture) {
    user = await db.user.update({ where: { id: user.id }, data: { image: profile.picture } });
  }
  if (timezone && timezone !== user.timezone) await db.user.update({ where: { id: user.id }, data: { timezone } });

  await createSession(user.id);
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { profile: true } });
  const res = NextResponse.redirect(`${base}${onboardingPath(full) ?? "/dashboard"}`);
  res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
  return res;
}
