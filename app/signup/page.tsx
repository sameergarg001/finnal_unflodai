import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AuthForm } from "@/components/AuthForm";
import { AuthScreen } from "@/components/AuthScreen";
import { signupAction } from "../actions";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <AuthScreen subtitle="Your daily mentor for real-world skills">
      <AuthForm mode="signup" action={signupAction} />
    </AuthScreen>
  );
}
