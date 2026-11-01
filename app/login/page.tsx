import { redirect } from "next/navigation";
import { getCurrentUser, onboardingPath } from "@/server/auth/session";
import { AuthForm } from "@/components/AuthForm";
import { AuthScreen } from "@/components/AuthScreen";
import { loginAction } from "../actions";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(onboardingPath(user) ?? "/dashboard");
  return (
    <AuthScreen title="Welcome back" subtitle="Sign in to continue" back="/welcome">
      <AuthForm mode="login" action={loginAction} />
    </AuthScreen>
  );
}
