import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AuthForm } from "@/components/AuthForm";
import { Card } from "@/components/ui";
import { loginAction } from "../actions";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="mb-6 text-center text-2xl font-bold">Welcome back</h1>
      <Card>
        <AuthForm mode="login" action={loginAction} />
      </Card>
    </main>
  );
}
