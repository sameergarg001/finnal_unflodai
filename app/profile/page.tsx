import Link from "next/link";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { preferencesOf } from "@/server/services/notifications";
import { AppShell, More } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { ProfileForm } from "@/components/ProfileForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Avatar, Card, Icon, Notice, Pill, btnSecondary, input, type IconName } from "@/components/ui";
import {
  changePasswordAction,
  deleteAccountAction,
  logoutAction,
  removeSkillAction,
  updatePreferencesAction,
  updateProfileAction,
} from "../actions";

export const dynamic = "force-dynamic";

const SAVED: Record<string, string> = { skills: "Skill removed (its history is kept)", preferences: "Settings saved", assessment: "Self-assessment updated" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireReadyUser();
  const { saved } = await searchParams;
  const full = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true, googleId: true, createdAt: true } });
  const skills = await db.userSkill.findMany({ where: { userId: user.id, isActive: true }, include: { skill: true }, orderBy: { skill: { sortOrder: "asc" } } });
  const prefs = preferencesOf(user.profile?.preferences);

  return (
    <AppShell title="Profile">
      <Card className="flex flex-col items-center !pt-7 text-center">
        <Avatar name={user.name ?? user.email} image={user.image} size={84} />
        <p className="mt-3 max-w-full truncate font-display text-2xl font-bold">{user.name ?? "Your profile"}</p>
        <p className="max-w-full truncate text-sm text-muted">{user.email}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {user.profile?.occupation && <Pill tone="accent">{user.profile.occupation}</Pill>}
          {user.age ? <Pill>{user.age} yrs</Pill> : null}
          <Pill>Since {full.createdAt.toLocaleDateString(undefined, { month: "short", year: "numeric" })}</Pill>
        </div>
      </Card>

      {saved && SAVED[saved] && <Notice tone="success">✓ {SAVED[saved]}</Notice>}

      {user.profile?.goals && (
        <div className="flex items-start gap-3.5 rounded-[28px] bg-gradient-to-br from-accent-soft to-sun-soft p-5 shadow-soft">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card-solid text-accent"><Icon name="target" /></span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-accent">My goal</p>
            <p className="mt-0.5 font-medium leading-snug">{user.profile.goals}</p>
          </div>
        </div>
      )}

      <More label={<Lbl icon="pencil">Edit profile</Lbl>}>
        <ProfileForm
          action={updateProfileAction}
          submitText="Save profile"
          values={{ name: user.name ?? "", age: user.age, profession: user.profile?.occupation ?? "", goal: user.profile?.goals ?? "", about: user.profile?.about ?? "" }}
        />
        <p className="mt-3 text-xs text-muted">Changing your profile never erases your development history.</p>
      </More>

      <More label={<Lbl icon="target">My skills</Lbl>}>
        <ul className="divide-y divide-line">
          {skills.map(({ skill }) => (
            <li key={skill.id} className="flex items-center justify-between gap-2 py-3">
              <Link href={`/skills/${skill.id}`} className="font-medium">{skill.name}</Link>
              {skill.category === "core" ? (
                <Pill>core</Pill>
              ) : (
                <form action={removeSkillAction}>
                  <input type="hidden" name="skillId" value={skill.id} />
                  <button className="text-sm text-danger">Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2 [&>a]:!text-sm">
          <Link href="/skills/add" className={btnSecondary}>+ Add skill</Link>
          <Link href="/onboarding/assessment?from=profile" className={btnSecondary}>Re-rate core</Link>
        </div>
      </More>

      <More label={<Lbl icon="bell">Notifications</Lbl>}>
        <form action={updatePreferencesAction} className="space-y-1">
          <input type="hidden" name="notifications" value="1" />
          <Toggle name="n_active" label="Active task reminders" checked={prefs.notifications.activeChallenge} />
          <Toggle name="n_feedback" label="Task waiting for feedback" checked={prefs.notifications.feedback} />
          <Toggle name="n_reports" label="Development report updates" checked={prefs.notifications.reports} />
          <Toggle name="n_inactive" label="Skills you haven't practised recently" checked={prefs.notifications.inactiveSkill} />
          <p className="pb-3 pt-1 text-xs text-muted">In-app only. We keep them few.</p>
          <SubmitButton variant="secondary">Save</SubmitButton>
        </form>
      </More>

      <More label={<Lbl icon="palette">Theme</Lbl>}>
        <form action={updatePreferencesAction} className="grid grid-cols-2 gap-2">
          {(["dark", "light"] as const).map((t) => (
            <button key={t} name="theme" value={t} className={`min-h-12 rounded-full px-4 py-3 font-semibold capitalize ${prefs.theme === t ? "bg-accent text-on-accent" : "bg-card-2"}`}>
              {t === "dark" ? "🌙" : "☀️"} {t}
            </button>
          ))}
        </form>
      </More>

      <More label={<Lbl icon="lock">Account security</Lbl>}>
        <p className="mb-3 text-sm text-muted">
          {full.googleId ? "Signed in with Google. " : ""}
          {full.passwordHash ? "You can also sign in with email and password." : "No password set — you can add one to also sign in with email."}
        </p>
        <ActionForm action={changePasswordAction} className="space-y-3" resetOnSuccess>
          {full.passwordHash && <input name="current" type="password" required placeholder="Current password" autoComplete="current-password" className={input} />}
          <input name="next" type="password" required minLength={8} placeholder="New password (8+ characters)" autoComplete="new-password" className={input} />
          <SubmitButton variant="secondary">{full.passwordHash ? "Change password" : "Set password"}</SubmitButton>
        </ActionForm>
      </More>

      <form action={logoutAction} className="pt-2">
        <button className={btnSecondary}><Icon name="logout" /> Log out</button>
      </form>

      <More label={<span className="text-danger">Delete account</span>}>
        <p className="mb-3 text-sm text-muted">This permanently deletes your profile, skills, tasks, feedback and reports. It can&apos;t be undone.</p>
        <ActionForm action={deleteAccountAction} className="space-y-3" confirm="Delete your account and all data permanently?">
          <input name="confirm" required placeholder="Type DELETE to confirm" className={input} autoComplete="off" />
          <button className="min-h-12 w-full rounded-2xl bg-danger px-4 py-3 font-semibold text-white">Delete my account</button>
        </ActionForm>
      </More>
    </AppShell>
  );
}

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-1 text-sm">
      {label}
      <input type="checkbox" name={name} defaultChecked={checked} className="peer sr-only" />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-card-2 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

function Lbl({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent"><Icon name={icon} className="h-[18px] w-[18px]" /></span>
      {children}
    </span>
  );
}
