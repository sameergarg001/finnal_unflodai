import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { getCoreSkills } from "@/server/services/assessment";
import { AssessmentForm } from "@/components/AssessmentForm";
import { Logo } from "@/components/ui";
import { assessmentAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AssessmentPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const user = await requireUser();
  const { from } = await searchParams;
  if (!user.profile?.onboardingDone) redirect("/onboarding/profile");
  const [core, scores] = await Promise.all([getCoreSkills(), db.skillScore.findMany({ where: { userId: user.id } })]);
  const self = new Map(scores.map((s) => [s.skillId, s.selfScore]));

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="animate-enter mb-6 text-center">
        <div className="flex justify-center"><Logo size={48} /></div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent">{from === "profile" ? "Update self-assessment" : "Step 2 of 2"}</p>
        <h1 className="mt-1 text-2xl font-bold">Rate your core skills</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Tap the level that feels true today (you can fine-tune 0–100). This is your own <b className="text-fg">self-assessment</b> — not a test or a
          scientific measure. UnfoldAI tracks real progress separately, from the tasks you complete.
        </p>
      </div>
      <AssessmentForm
        action={assessmentAction}
        from={from === "profile" ? "profile" : undefined}
        skills={core.map((s) => ({ id: s.id, name: s.name, description: s.description, initial: self.get(s.id) ?? null }))}
      />
    </div>
  );
}
