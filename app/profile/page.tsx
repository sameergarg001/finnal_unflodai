import Link from "next/link";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { preferencesOf } from "@/server/services/notifications";
import { AppShell, More } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { ProfileForm } from "@/components/ProfileForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Avatar, Card, Notice, Pill, btnSecondary, input } from "@/components/ui";
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
      <Card className="flex items-center gap-4">
        <Avatar name={user.name ?? user.email} image={user.image} size={64} />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{user.name ?? "Your profile"}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
          <p className="mt-0.5 text-xs text-muted">
            Joined {full.createdAt.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            {user.age ? ` · ${user.age} yrs` : ""}
            {user.profile?.occupation ? ` · ${user.profile.occupation}` : ""}
          </p>
        </div>
      </Card>

      {saved && SAVED[saved] && <Notice tone="success">✓ {SAVED[saved]}</Notice>}

      {user.profile?.goals && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">My goal</p>
          <p className="mt-1">{user.profile.goals}</p>
        </Card>
      )}

      <More label="✏️ Edit profile">
        <ProfileForm
          action={updateProfileAction}
          submitText="Save profile"
          values={{ name: user.name ?? "", age: user.age, profession: user.profile?.occupation ?? "", goal: user.profile?.goals ?? "", about: user.profile?.about ?? "" }}
        />
        <p className="mt-3 text-xs text-muted">Changing your profile never erases your development history.</p>
      </More>

      <More label="🎯 My skills">
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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/skills/add" className={btnSecondary}>+ Add skill</Link>
          <Link href="/onboarding/assessment?from=profile" className={btnSecondary}>Re-rate core</Link>
        </div>
      </More>

      <More label="🔔 Notifications">
        <form action={updatePreferencesAction} className="space-y-1">
          <input type="hidden" name="notifications" value="1" />
          <Toggle name="n_active" label="Active challenge reminders" checked={prefs.notifications.activeChallenge} />
          <Toggle name="n_feedback" label="Challenge waiting for feedback" checked={prefs.notifications.feedback} />
          <Toggle name="n_reports" label="Development report updates" checked={prefs.notifications.reports} />
          <Toggle name="n_inactive" label="Skills you haven't practised recently" checked={prefs.notifications.inactiveSkill} />
          <p className="pb-3 pt-1 text-xs text-muted">Shown in the app&apos;s notification centre. We keep them few.</p>
          <SubmitButton variant="secondary">Save</SubmitButton>
        </form>
      </More>

      <More label="🎨 Theme">
        <form action={updatePreferencesAction} className="grid grid-cols-2 gap-2">
          {(["dark", "light"] as const).map((t) => (
            <button key={t} name="theme" value={t} className={`min-h-12 rounded-2xl border px-4 py-3 font-semibold capitalize ${prefs.theme === t ? "border-accent bg-accent/15 text-accent" : "border-line bg-card-2"}`}>
              {t === "dark" ? "🌙" : "☀️"} {t}
            </button>
          ))}
        </form>
      </More>

      <More label="🔒 Account security">
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
        <button className={`${btnSecondary}`}>Log out</button>
      </form>

      <More label={<span className="text-danger">Delete account</span>}>
        <p className="mb-3 text-sm text-muted">This permanently deletes your profile, skills, challenges, feedback and reports. It can&apos;t be undone.</p>
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
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-card-2 transition peer-checked:bg-accent after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}
