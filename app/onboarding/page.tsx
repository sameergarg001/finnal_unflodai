import { db } from "@/lib/db";
import { requireUser } from "@/server/auth/session";
import { Card, PageTitle, input, label } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { onboardingAction } from "../actions";

export default async function OnboardingPage() {
  const user = await requireUser();
  const skills = await db.skill.findMany({ orderBy: { sortOrder: "asc" } });
  const core = skills.filter((s) => s.category === "core");
  const specific = skills.filter((s) => s.category === "specific");
  const selected = new Set(
    (await db.userSkill.findMany({ where: { userId: user.id, isActive: true } })).map((u) => u.skillId),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageTitle
        title={`Hi ${user.name ?? "there"}, let's get to know you`}
        subtitle="This helps UnfoldAI design challenges that fit your real life."
      />
      <form action={onboardingAction} className="space-y-6">
        <Card className="space-y-4">
          <div>
            <label className={label} htmlFor="occupation">What do you do?</label>
            <input
              id="occupation"
              name="occupation"
              className={input}
              placeholder="e.g. Final-year engineering student, sales associate, startup founder"
              defaultValue={user.profile?.occupation ?? ""}
            />
          </div>
          <div>
            <label className={label} htmlFor="goals">What do you want to get better at, and why?</label>
            <textarea
              id="goals"
              name="goals"
              rows={3}
              className={input}
              placeholder="e.g. I freeze up in meetings and want to share my ideas confidently."
              defaultValue={user.profile?.goals ?? ""}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Core skills</h2>
          <p className="text-sm text-slate-600">Everyone develops these — they're included automatically.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {core.map((s) => (
              <li key={s.id} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
                ✓ {s.name}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold">Specific skills</h2>
          <p className="text-sm text-slate-600">Choose any you want to focus on. You can change these later.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {specific.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 hover:border-brand-500 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
              >
                <input type="checkbox" name="specific" value={s.slug} defaultChecked={selected.has(s.id)} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium">{s.name}</span>
                  <span className="block text-xs text-slate-500">{s.description}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <SubmitButton>Continue to assessment →</SubmitButton>
      </form>
    </main>
  );
}
