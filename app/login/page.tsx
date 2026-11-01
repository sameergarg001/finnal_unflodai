import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AuthForm } from "@/components/AuthForm";
import { AuthScreen } from "@/components/AuthScreen";
import { loginAction } from "../actions";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <AuthScreen subtitle="Welcome back">
      <AuthForm mode="login" action={loginAction} />
    </AuthScreen>
  );
}
