import Link from "next/link";
import { requireReadyUser } from "@/server/auth/session";
import { searchSkills } from "@/server/services/skills";
import { SKILL_GROUPS } from "@/server/skills/catalog";
import { AppShell, More } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { SelfScoreSlider } from "@/components/SelfScoreSlider";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, EmptyState, SectionTitle, TeacherAvatar, input, label } from "@/components/ui";
import { addSkillAction } from "../../actions";

export const dynamic = "force-dynamic";

type Item = Awaited<ReturnType<typeof searchSkills>>[number];

export default async function AddSkillPage({ searchParams }: { searchParams: Promise<{ q?: string; g?: string }> }) {
  const user = await requireReadyUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const g = SKILL_GROUPS.some((x) => x.id === sp.g) || sp.g === "mine" ? sp.g : undefined;
  const results = await searchSkills(user.id, q, g);
  const groups = [...SKILL_GROUPS, { id: "mine", label: "My custom skills", hint: "Skills you created" }];
  const sections = groups.map((grp) => ({ ...grp, items: results.filter((r) => r.group === grp.id) })).filter((s) => s.items.length);

  return (
    <AppShell title="Add a skill" back="/dashboard">
      <form className="relative">
        {g && <input type="hidden" name="g" value={g} />}
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 mt-0.5 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input name="q" defaultValue={q} placeholder="Search: coding, Excel, UPSC…" className={`${input} pl-11`} autoComplete="off" enterKeyHint="search" />
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip href={`/skills/add${q ? `?q=${encodeURIComponent(q)}` : ""}`} on={!g}>All</Chip>
        {SKILL_GROUPS.map((grp) => (
          <Chip key={grp.id} href={`/skills/add?g=${grp.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} on={g === grp.id}>{grp.label}</Chip>
        ))}
      </div>

      {sections.length ? (
        sections.map((sec) => (
          <section key={sec.id}>
            <SectionTitle>{sec.label}</SectionTitle>
            <p className="-mt-1 mb-2 px-1 text-xs text-muted">{sec.hint}</p>
            <Card className="divide-y divide-line !py-1">
              {sec.items.map((s) => <Row key={s.id} s={s} />)}
            </Card>
          </section>
        ))
      ) : (
        <EmptyState icon="🔎" title={q ? `No skill called “${q}” yet` : "Nothing here yet"} body="Create it as your own skill below — you'll get your own coach for it." />
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
      <p className="px-1 text-xs text-muted">Your 4 core skills are always on Home. Duplicates are detected automatically.</p>
    </AppShell>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${on ? "bg-accent text-white" : "border border-line bg-card text-muted"}`}>
      {children}
    </Link>
  );
}

function Row({ s }: { s: Item }) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <TeacherAvatar emoji={s.teacher.emoji} size={38} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{s.name}</p>
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
  );
}
