import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_STATE_COOKIE, appUrl, googleAuthUrl, googleConfigured } from "@/server/auth/google";
import { rateLimit } from "@/lib/rateLimit";

/** Starts Google sign-in: redirects to Google's consent screen. */
export async function GET(req: NextRequest) {
  const base = appUrl(req.nextUrl.origin);
  if (!googleConfigured()) return NextResponse.redirect(`${base}/welcome?error=google_not_configured`);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`google:${ip}`, 20, 10 * 60_000)) return NextResponse.redirect(`${base}/welcome?error=too_many`);

  const state = randomBytes(24).toString("base64url");
  const tz = (req.nextUrl.searchParams.get("tz") ?? "").slice(0, 64);
  const res = NextResponse.redirect(googleAuthUrl(base, state));
  res.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, tz }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
