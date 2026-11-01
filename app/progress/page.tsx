import Link from "next/link";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { recallInsights } from "@/server/engine/memory";
import { Nav } from "@/components/Nav";
import { Card, PageTitle, Sparkline, levelName } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await requireReadyUser();
  const [scores, events, history, insights] = await Promise.all([
    db.skillScore.findMany({ where: { userId: user.id }, include: { skill: true } }),
    db.skillScoreEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.challenge.findMany({
      where: { userId: user.id, status: { not: "assigned" } },
      include: { skill: true },
      orderBy: { assignedAt: "desc" },
      take: 20,
    }),
    recallInsights(user.id, "", 8),
  ]);

  const seriesBySkill = new Map<string, number[]>();
  for (const e of events) {
    const arr = seriesBySkill.get(e.skillId) ?? [];
    arr.push(e.newScore);
    seriesBySkill.set(e.skillId, arr);
  }
  const growth = scores
    .map((s) => {
      const series = seriesBySkill.get(s.skillId) ?? [s.score];
      return { ...s, series, change: s.score - series[0] };
    })
    .sort((a, b) => a.skill.sortOrder - b.skill.sortOrder);

  return (
    <>
      <Nav name={user.name} />
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <PageTitle title="Your progress" subtitle="Scores move slowly on purpose — they change based on evidence from real challenges." />

        <Card>
          <h2 className="mb-4 font-semibold">Skill growth</h2>
          <div className="divide-y divide-slate-100">
            {growth.map((g) => (
              <div key={g.skillId} className="flex items-center gap-4 py-3">
                <div className="w-48">
                  <p className="text-sm font-medium">{g.skill.name}</p>
                  <p className="text-xs text-slate-500">{levelName(g.score)} · {Math.round(g.score)}/100</p>
                </div>
                <Sparkline values={g.series} />
                <span className={`ml-auto text-sm font-medium ${g.change > 0 ? "text-emerald-600" : g.change < 0 ? "text-amber-600" : "text-slate-400"}`}>
                  {g.change > 0 ? "+" : ""}{g.change.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-semibold">What we've learned about you</h2>
            {insights.length === 0 ? (
              <p className="text-sm text-slate-500">Complete a few challenges with detailed reflections to see insights here.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {insights.map((i) => (
                  <li key={i.text} className="flex gap-2">
                    <span className="mt-0.5 rounded bg-slate-100 px-1.5 text-[11px] uppercase text-slate-600">{i.kind}</span>
                    <span>{i.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Challenge history</h2>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No finished challenges yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {history.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3">
                    <Link href={`/challenge/${c.id}`} className="truncate hover:text-brand-600">{c.title}</Link>
                    <span className="shrink-0 text-xs text-slate-500">{c.skill.name} · {c.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
