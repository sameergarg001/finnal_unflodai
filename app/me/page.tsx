import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { LEVELS, levelForScore } from "@/server/assessment/levels";
import { AppShell, More } from "@/components/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, btnSecondary, input } from "@/components/ui";
import { logoutAction, updateAboutAction, updateLevelsAction, updateSkillsAction } from "../actions";

export const dynamic = "force-dynamic";

const SAVED: Record<string, string> = { skills: "Skills saved", levels: "Levels saved", about: "Saved" };

export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireReadyUser();
  const { saved } = await searchParams;
  const [specific, mine, scores] = await Promise.all([
    db.skill.findMany({ where: { category: "specific" }, orderBy: { sortOrder: "asc" } }),
    db.userSkill.findMany({ where: { userId: user.id, isActive: true } }),
    db.skillScore.findMany({ where: { userId: user.id }, include: { skill: true } }),
  ]);
  const active = new Set(mine.map((m) => m.skillId));
  const activeScores = scores.filter((s) => active.has(s.skillId)).sort((a, b) => a.skill.sortOrder - b.skill.sortOrder);

  return (
    <AppShell title="Me">
      <Card className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
          {(user.name ?? user.email)[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.name ?? "Your profile"}</p>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
        </div>
      </Card>

      {saved && SAVED[saved] && <p className="text-center text-sm font-medium text-emerald-600">✓ {SAVED[saved]}</p>}

      <p className="px-1 pt-2 text-xs text-slate-400">All optional — your mentor works fine without these.</p>

      <More label="About me">
        <form action={updateAboutAction} className="space-y-3">
          <input name="name" defaultValue={user.name ?? ""} placeholder="Name" className={input} />
          <input name="occupation" defaultValue={user.profile?.occupation ?? ""} placeholder="What you do (e.g. student, developer)" className={input} />
          <textarea name="goals" rows={2} defaultValue={user.profile?.goals ?? ""} placeholder="What you want to get better at" className={input} />
          <SubmitButton>Save</SubmitButton>
        </form>
      </More>

      <More label="Extra skills to work on">
        <form action={updateSkillsAction} className="space-y-3">
          <p className="text-xs text-slate-500">12 core skills are always included. Add any extras:</p>
          <div className="flex flex-wrap gap-2">
            {specific.map((s) => (
              <label key={s.id} className="cursor-pointer">
                <input type="checkbox" name="specific" value={s.slug} defaultChecked={active.has(s.id)} className="peer sr-only" />
                <span className="inline-block rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600 peer-checked:bg-brand-600 peer-checked:text-white">
                  {s.name}
                </span>
              </label>
            ))}
          </div>
          <SubmitButton>Save skills</SubmitButton>
        </form>
      </More>

      <More label="My levels">
        <form action={updateLevelsAction} className="space-y-1">
          <p className="pb-2 text-xs text-slate-500">
            Levels adjust automatically as you practise. Change one only if it feels wrong.
          </p>
          {activeScores.map((s) => (
            <label key={s.skillId} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span>{s.skill.name}</span>
              <select
                name={`level:${s.skillId}`}
                defaultValue={levelForScore(s.score).value}
                className="rounded-lg border-0 bg-slate-100 px-2 py-1.5 text-sm"
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.name}</option>
                ))}
              </select>
            </label>
          ))}
          <div className="pt-3"><SubmitButton>Save levels</SubmitButton></div>
        </form>
      </More>

      <form action={logoutAction} className="pt-4">
        <button className={`${btnSecondary} !text-red-600`}>Log out</button>
      </form>
    </AppShell>
  );
}
