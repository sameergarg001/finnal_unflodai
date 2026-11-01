// Google sign-in (OAuth 2.0 authorization-code flow, server-side only).
// The client secret never leaves the server; identity comes from Google's
// OpenID userinfo endpoint using the access token we exchanged ourselves.

export const GOOGLE_STATE_COOKIE = "ufa_google_state";

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Base URL of the app, e.g. http://localhost:3000. Must match the redirect URI registered with Google. */
export function appUrl(fallbackOrigin: string): string {
  return (process.env.APP_URL || fallbackOrigin).replace(/\/$/, "");
}

export function googleAuthUrl(base: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${base}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export async function exchangeCodeForProfile(base: string, code: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${base}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !token.access_token) throw new Error(`Google token exchange failed: ${token.error ?? tokenRes.status}`);

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const info = (await infoRes.json().catch(() => ({}))) as Partial<GoogleProfile>;
  if (!infoRes.ok || !info.sub || !info.email) throw new Error("Google profile request failed");
  return { sub: info.sub, email: info.email.toLowerCase(), email_verified: !!info.email_verified, name: info.name, picture: info.picture };
}
