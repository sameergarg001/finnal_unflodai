import { getOrCreateDailyBrief } from "@/server/services/mentor";

type UserLite = { id: string; name: string | null; timezone: string };

/** Today's personalised mentor message. Streamed with Suspense so the screen never waits on the AI. */
export async function MentorBrief({ user }: { user: UserLite }) {
  const brief = await getOrCreateDailyBrief(user);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent/90 via-accent-strong to-[#4338ca] p-5 text-white shadow-xl shadow-accent/20">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-2/30 blur-2xl" />
      <p className="relative text-[15px] leading-relaxed">{brief.message}</p>
      <p className="relative mt-3 text-sm text-white/75">
        <span className="font-semibold text-white">Today:</span> {brief.focus}
      </p>
    </div>
  );
}

export function MentorBriefSkeleton() {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-accent/60 to-accent-strong/60 p-5">
      <div className="h-3 w-5/6 animate-pulse rounded bg-white/25" />
      <div className="mt-2.5 h-3 w-2/3 animate-pulse rounded bg-white/25" />
      <div className="mt-2.5 h-3 w-1/2 animate-pulse rounded bg-white/20" />
    </div>
  );
}
