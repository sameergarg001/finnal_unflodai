import { redirect } from "next/navigation";
import { getCurrentUser, onboardingPath } from "@/server/auth/session";
import { googleConfigured } from "@/server/auth/google";
import { AuthForm } from "@/components/AuthForm";
import { AuthScreen } from "@/components/AuthScreen";
import { GoogleButton } from "@/components/GoogleButton";
import { signupAction } from "../actions";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(onboardingPath(user) ?? "/dashboard");
  return (
    <AuthScreen title="Create your account" subtitle="It takes less than a minute" back="/welcome">
      <GoogleButton enabled={googleConfigured()} />
      <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
      <AuthForm mode="signup" action={signupAction} />
    </AuthScreen>
  );
}
