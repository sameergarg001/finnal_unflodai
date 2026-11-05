import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, onboardingPath } from "@/server/auth/session";
import { googleConfigured } from "@/server/auth/google";
import { AuthScreen } from "@/components/AuthScreen";
import { GoogleButton } from "@/components/GoogleButton";
import { LogoFull, Notice, ScoreRing, TeacherAvatar, btnPrimary } from "@/components/ui";

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up on this server yet. Use email for now.",
  google_cancelled: "Google sign-in was cancelled.",
  google_state: "Sign-in expired. Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
  google_unverified: "Your Google email isn't verified.",
  too_many: "Too many attempts. Please wait a few minutes.",
};

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(onboardingPath(user) ?? "/dashboard");
  const { error, deleted } = await searchParams;

  return (
    <AuthScreen title="Grow one skill at a time" subtitle="An AI mentor, a small task a day." hero={<WelcomeHero />}>
      <div className="space-y-3">
        {error && ERRORS[error] && <Notice tone="error">{ERRORS[error]}</Notice>}
        {deleted && <Notice tone="success">Your account and data were deleted.</Notice>}
        <GoogleButton enabled={googleConfigured()} />
        <Link href="/login" className={btnPrimary}>Sign in with email</Link>
        <p className="pt-3 text-center text-sm text-muted">
          New here? <Link href="/signup" className="font-semibold text-accent">Create an account</Link>
        </p>
      </div>
    </AuthScreen>
  );
}

/** A small, real preview of the app: score ring, teachers, a task. */
function WelcomeHero() {
  return (
    <div className="relative h-64 w-full max-w-[320px]" aria-hidden>
      <div className="glass absolute left-1/2 top-2 flex -translate-x-1/2 flex-col items-center rounded-[32px] px-7 pb-5 pt-6">
        <ScoreRing value={72} size={112} stroke={11} caption="UnfoldAI" />
      </div>
      <div className="glass absolute left-0 top-28 flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-sm font-semibold">
        <TeacherAvatar emoji="🗣️" size={36} /> Aanya
      </div>
      <div className="absolute right-0 top-10 flex items-center gap-2 rounded-full bg-sun-soft py-2 pl-3 pr-4 text-sm font-semibold shadow-soft">
        <span className="h-2 w-2 rounded-full bg-sun" /> Today&apos;s task
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2"><LogoFull height={30} /></div>
    </div>
  );
}
