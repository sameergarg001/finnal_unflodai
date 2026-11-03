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
        {from !== "profile" && <StepDots step={2} />}
        <h1 className="mt-3 text-[28px] font-extrabold">Rate your core skills</h1>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted">How do you feel today? Not a test — your tasks show real progress.</p>
      </div>
      <AssessmentForm
        action={assessmentAction}
        from={from === "profile" ? "profile" : undefined}
        skills={core.map((s) => ({ id: s.id, name: s.name, description: s.description, initial: self.get(s.id) ?? null }))}
      />
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="mt-4 flex justify-center gap-1.5" aria-label={`Step ${step} of 2`}>
      {[1, 2].map((i) => <span key={i} className={`h-1.5 rounded-full ${i <= step ? "w-8 bg-accent" : "w-4 bg-card-2"}`} />)}
    </div>
  );
}
