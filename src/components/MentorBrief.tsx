import { getOrCreateDailyBrief, getStreak } from "@/server/services/mentor";

type UserLite = { id: string; name: string | null; timezone: string };

/** Today's mentor check-in. Streamed in with Suspense so the dashboard never waits on the AI. */
export async function MentorBrief({ user }: { user: UserLite }) {
  const [brief, streak] = await Promise.all([getOrCreateDailyBrief(user), getStreak(user)]);
  return (
    <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
          U
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Your mentor · today</p>
            <StreakBadge current={streak.current} best={streak.best} doneToday={streak.doneToday} />
          </div>
          <p className="mt-2 text-slate-800">{brief.message}</p>
          <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold text-brand-700">Today&apos;s focus:</span> {brief.focus}
          </p>
        </div>
      </div>
    </div>
  );
}

export function StreakBadge({ current, best, doneToday }: { current: number; best: number; doneToday: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        current > 0 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
      }`}
      title={`Best streak: ${best} day${best === 1 ? "" : "s"}`}
    >
      🔥 {current} day{current === 1 ? "" : "s"} streak{current > 0 && !doneToday ? " · check in today to keep it" : ""}
    </span>
  );
}

export function MentorBriefSkeleton() {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">U</div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Your mentor · today</p>
          <p className="mt-2 animate-pulse text-slate-500">Your mentor is preparing today&apos;s check-in…</p>
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-brand-100" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-brand-100" />
        </div>
      </div>
    </div>
  );
}
