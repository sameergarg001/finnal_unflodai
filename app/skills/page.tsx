import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { Nav } from "@/components/Nav";
import { Card, PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { updateSkillsAction } from "../actions";

export default async function SkillsPage() {
  const user = await requireReadyUser();
  const [skills, mine] = await Promise.all([
    db.skill.findMany({ where: { category: "specific" }, orderBy: { sortOrder: "asc" } }),
    db.userSkill.findMany({ where: { userId: user.id, isActive: true } }),
  ]);
  const active = new Set(mine.map((m) => m.skillId));

  return (
    <>
      <Nav name={user.name} />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <PageTitle
          title="My specific skills"
          subtitle="Core skills are always included. Removing a specific skill keeps its history — add it back any time."
        />
        <form action={updateSkillsAction}>
          <Card>
            <div className="grid gap-3 sm:grid-cols-2">
              {skills.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
                >
                  <input type="checkbox" name="specific" value={s.slug} defaultChecked={active.has(s.id)} className="mt-1" />
                  <span>
                    <span className="block text-sm font-medium">{s.name}</span>
                    <span className="block text-xs text-slate-500">{s.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-6"><SubmitButton>Save skills</SubmitButton></div>
          </Card>
        </form>
      </main>
    </>
  );
}
