import Link from "next/link";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { getCurrentChallenge, suggestSkillId } from "@/server/services/challenges";
import { Nav } from "@/components/Nav";
import { StartSessionForm } from "@/components/StartSessionForm";
import { ButtonLink, Card, ScoreBar } from "@/components/ui";
import { levelByValue, levelForScore, levelProgress } from "@/server/assessment/levels";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; skills?: string; new?: string }>;
}) {
  const user = await requireReadyUser();
  const params = await searchParams;

  const [current, scores, completedCount, active, suggestedId] = await Promise.all([
    getCurrentChallenge(user.id),
    db.skillScore.findMany({ where: { userId: user.id }, include: { skill: true } }),
    db.challenge.count({ where: { userId: user.id, status: "completed" } }),
    db.userSkill.findMany({ where: { userId: user.id, isActive: true }, select: { skillId: true } }),
    suggestSkillId(user.id),
  ]);
  const activeIds = new Set(active.map((a) => a.skillId));
  const shown = scores
    .filter((s) => activeIds.has(s.skillId))
    .sort((a, b) => a.skill.sortOrder - b.skill.sortOrder);
  const core = shown.filter((s) => s.skill.category === "core");
  const specific = shown.filter((s) => s.skill.category === "specific");
  const options = shown.map((s) => {
    const lvl = levelForScore(s.score);
    return { id: s.skillId, name: s.skill.name, category: s.skill.category, levelName: lvl.name, levelValue: lvl.value };
  });

  return (
    <>
      <Nav name={user.name} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        {params.welcome && (
          <div className="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Your skill profile is ready. Pick a skill below, tell UnfoldAI about a real situation, and get your first practical step.
          </div>
        )}
        {params.skills && (
          <div className="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Your skills were updated.</div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            {current && !params.new ? (
              <>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your current step</h2>
                <Card>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">{current.skill.name}</span>
                    <span className="text-slate-500">Step {current.stepNumber} · ~{current.estimatedMinutes} min</span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">{current.title}</h3>
                  {current.situation && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">Situation: {current.situation}</p>
                  )}
                  <p className="mt-2 line-clamp-3 text-slate-700">{current.instructions}</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <ButtonLink href={`/challenge/${current.id}`}>Open step & give feedback →</ButtonLink>
                    <ButtonLink href="/dashboard?new=1" variant="secondary">Work on something else</ButtonLink>
                  </div>
                </Card>
              </>
            ) : (
              <>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">What do you want to work on?</h2>
                <Card>
                  {options.length > 0 ? (
                    <StartSessionForm skills={options} suggestedId={suggestedId} />
                  ) : (
                    <p>No skills are active. <Link href="/skills" className="text-brand-600">Choose skills</Link>.</p>
                  )}
                  {current && (
                    <p className="mt-4 text-xs text-slate-500">
                      Starting a new session closes your open step &ldquo;{current.title}&rdquo;.{" "}
                      <Link href="/dashboard" className="text-brand-600">Keep working on it instead</Link>
                    </p>
                  )}
                </Card>
              </>
            )}
          </section>

          <aside>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your progress</h2>
            <Card>
              <p className="text-3xl font-bold">{completedCount}</p>
              <p className="text-sm text-slate-600">practical steps completed</p>
              <Link href="/progress" className="mt-3 inline-block text-sm font-medium text-brand-600">
                View progress →
              </Link>
            </Card>
          </aside>
        </div>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <SkillGroup title="Core skills" items={core} />
          <SkillGroup title="Specific skills" items={specific} manage />
        </section>
      </main>
    </>
  );
}

type SkillRow = { skillId: string; score: number; startingLevel: number | null; skill: { name: string } };

function SkillGroup({ title, items, manage }: { title: string; items: SkillRow[]; manage?: boolean }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {manage && <Link href="/skills" className="text-sm text-brand-600">Edit</Link>}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">None selected yet.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((s) => <SkillLevelRow key={s.skillId} row={s} />)}
        </ul>
      )}
    </Card>
  );
}

function SkillLevelRow({ row }: { row: SkillRow }) {
  const { level, next, pct, pointsToNext } = levelProgress(row.score);
  const started = levelByValue(row.startingLevel);
  const moved = started ? level.value - started.value : 0;

  return (
    <li>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{row.skill.name}</span>
        <span className="flex items-center gap-1.5">
          {moved > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              ▲ {moved === 1 ? "Leveled up" : `+${moved} levels`}
            </span>
          )}
          {moved < 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">▼ Adjusted</span>
          )}
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
            Lv {level.value} · {level.name}
          </span>
        </span>
      </div>
      <ScoreBar score={pct} />
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{started ? `You started at: ${started.name}` : " "}</span>
        <span>{next ? `${Math.ceil(pointsToNext)} pts to ${next.name}` : "Top level reached"}</span>
      </div>
    </li>
  );
}
