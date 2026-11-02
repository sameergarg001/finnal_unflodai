import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, onboardingPath } from "@/server/auth/session";
import { googleConfigured } from "@/server/auth/google";
import { AuthScreen } from "@/components/AuthScreen";
import { GoogleButton } from "@/components/GoogleButton";
import { Notice, btnPrimary } from "@/components/ui";

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
    <AuthScreen title="UnfoldAI" subtitle="Build the skills that move your life forward.">
      <p className="mx-auto mb-10 max-w-xs text-center text-[15px] leading-relaxed text-muted">
        Your personal AI mentor. Real-life tasks, honest feedback, and progress you can actually see.
      </p>
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
