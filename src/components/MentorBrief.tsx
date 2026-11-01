import { getOrCreateDailyBrief } from "@/server/services/mentor";

type UserLite = { id: string; name: string | null; timezone: string };

/** Today's mentor check-in. Streamed in with Suspense so the screen never waits on the AI. */
export async function MentorBrief({ user }: { user: UserLite }) {
  const brief = await getOrCreateDailyBrief(user);
  return (
    <div className="rounded-2xl bg-brand-600 p-5 text-white">
      <p className="text-[15px] leading-relaxed">{brief.message}</p>
      <p className="mt-3 text-sm text-brand-100">
        <span className="font-semibold text-white">Today:</span> {brief.focus}
      </p>
    </div>
  );
}

export function MentorBriefSkeleton() {
  return (
    <div className="rounded-2xl bg-brand-600 p-5 text-white">
      <p className="animate-pulse text-brand-100">Your mentor is thinking about your day…</p>
      <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-white/20" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-white/20" />
    </div>
  );
}

export function StreakChip({ current }: { current: number }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${current > 0 ? "bg-orange-100 text-orange-600" : "bg-slate-200 text-slate-500"}`}>
      🔥 {current}
    </span>
  );
}

export function StreakBadge({ current, best, doneToday }: { current: number; best: number; doneToday: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${current > 0 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}
      title={`Best streak: ${best} day${best === 1 ? "" : "s"}`}
    >
      🔥 {current} day{current === 1 ? "" : "s"}{current > 0 && !doneToday ? " · check in today to keep it" : ""}
    </span>
  );
}
