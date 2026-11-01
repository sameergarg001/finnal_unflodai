import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AuthForm } from "@/components/AuthForm";
import { Card } from "@/components/ui";
import { signupAction } from "../actions";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="mb-2 text-center text-2xl font-bold">Start unfolding</h1>
      <p className="mb-6 text-center text-sm text-slate-600">Takes about 5 minutes to set up.</p>
      <Card>
        <AuthForm mode="signup" action={signupAction} />
      </Card>
    </main>
  );
}
