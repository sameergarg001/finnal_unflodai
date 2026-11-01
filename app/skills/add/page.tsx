import { requireReadyUser } from "@/server/auth/session";
import { searchSkills } from "@/server/services/skills";
import { AppShell, More } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { SelfScoreSlider } from "@/components/SelfScoreSlider";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, EmptyState, Pill, input, label } from "@/components/ui";
import { addSkillAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AddSkillPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireReadyUser();
  const q = ((await searchParams).q ?? "").slice(0, 60);
  const results = await searchSkills(user.id, q);

  return (
    <AppShell title="Add a skill" back="/dashboard">
      <form className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 mt-0.5 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input name="q" defaultValue={q} placeholder="Search skills — networking, leadership…" className={`${input} pl-11`} autoComplete="off" enterKeyHint="search" />
      </form>

      {results.length ? (
        <Card className="divide-y divide-line !py-1">
          {results.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.name} {s.custom && <Pill>custom</Pill>}</p>
                <p className="line-clamp-2 text-xs text-muted">{s.description}</p>
              </div>
              {s.added ? (
                <span className="text-sm font-medium text-success">Added ✓</span>
              ) : (
                <ActionForm action={addSkillAction}>
                  <input type="hidden" name="skillId" value={s.id} />
                  <SubmitButton className="!min-h-10 !w-auto !rounded-xl !px-4 !py-2 !text-sm" pendingText="">Add</SubmitButton>
                </ActionForm>
              )}
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState icon="🔎" title={`No skill called “${q}” yet`} body="Create it as your own custom skill below." />
      )}

      <More label="➕ Create your own skill" open={!!q && results.length === 0}>
        <ActionForm action={addSkillAction} className="space-y-4">
          <div>
            <label className={label} htmlFor="name">Skill name</label>
            <input id="name" name="name" required minLength={2} maxLength={60} defaultValue={results.length ? "" : q} className={input} placeholder="e.g. Cold emailing" />
          </div>
          <div>
            <label className={label} htmlFor="subskills">Subskills <span className="text-muted/70">(optional, comma separated)</span></label>
            <input id="subskills" name="subskills" className={input} placeholder="e.g. Subject lines, Personalisation, Follow-ups" />
          </div>
          <SelfScoreSlider initial={null} optional />
          <SubmitButton pendingText="Adding…">Add skill</SubmitButton>
        </ActionForm>
      </More>
      <p className="px-1 text-xs text-muted">Your five core skills are always on your dashboard. Duplicates are detected automatically.</p>
    </AppShell>
  );
}
