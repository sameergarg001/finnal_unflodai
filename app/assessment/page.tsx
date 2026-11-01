import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { getAssessmentSkills } from "@/server/services/assessment";
import { LEVELS } from "@/server/assessment/levels";
import { Card, PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { assessmentAction } from "../actions";

export default async function AssessmentPage() {
  const user = await requireUser();
  if (!user.profile?.onboardingDone) redirect("/onboarding");
  const done = await db.assessment.findFirst({
    where: { userId: user.id, type: "initial", completedAt: { not: null } },
  });
  if (done) redirect("/dashboard");

  const skills = await getAssessmentSkills(user.id);
  const groups = [
    { title: "Core skills", items: skills.filter((s) => s.category === "core") },
    { title: "Your specific skills", items: skills.filter((s) => s.category === "specific") },
  ].filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageTitle
        title="Where do you stand?"
        subtitle="Pick your current level for each skill. Be honest — this is just a starting point, and UnfoldAI adjusts it as you complete challenges."
      />

      <Card className="mb-6">
        <ul className="grid gap-2 text-sm sm:grid-cols-5">
          {LEVELS.map((l) => (
            <li key={l.value}>
              <span className="font-semibold">{l.value}. {l.name}</span>
              <span className="block text-xs text-slate-500">{l.description}</span>
            </li>
          ))}
        </ul>
      </Card>

      <form action={assessmentAction} className="space-y-6">
        {groups.map((g) => (
          <Card key={g.title}>
            <h2 className="mb-4 font-semibold">{g.title}</h2>
            <div className="divide-y divide-slate-100">
              {g.items.map((skill) => (
                <fieldset key={skill.id} className="py-4 first:pt-0 last:pb-0">
                  <legend className="text-sm font-medium">{skill.name}</legend>
                  <p className="text-xs text-slate-500">{skill.description}</p>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {LEVELS.map((l) => (
                      <label
                        key={l.value}
                        className="flex cursor-pointer flex-col items-center rounded-lg border border-slate-200 px-1 py-2 text-center text-xs text-slate-600 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700"
                      >
                        <input type="radio" name={skill.id} value={l.value} required className="sr-only" />
                        {l.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </Card>
        ))}
        <SubmitButton pendingText="Setting up your profile…">See my skill profile →</SubmitButton>
      </form>
    </main>
  );
}
