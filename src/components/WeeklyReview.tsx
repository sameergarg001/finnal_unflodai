import { getOrCreateWeeklyReview } from "@/server/services/mentor";
import { Card } from "./ui";

type UserLite = { id: string; name: string | null; timezone: string };

/** Mentor's weekly review. Streamed in with Suspense. */
export async function WeeklyReview({ user }: { user: UserLite }) {
  const review = await getOrCreateWeeklyReview(user);
  return (
    <Card>
      <h2 className="font-semibold">Your mentor&apos;s weekly review</h2>
      {!review ? (
        <p className="mt-2 text-sm text-slate-500">
          Complete and give feedback on a few steps this week, and your mentor will review your week here.
        </p>
      ) : (
        <div className="mt-3 space-y-4 text-sm">
          <p className="text-slate-800">{review.content.summary}</p>
          {review.content.wins.length > 0 && (
            <div>
              <h3 className="font-semibold text-emerald-700">Wins this week</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
                {review.content.wins.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}
          {review.content.mainPainPoint && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <span className="font-semibold">Main pain point:</span> {review.content.mainPainPoint}
            </div>
          )}
          <p className="text-slate-700">
            <span className="font-semibold">Next week:</span> {review.content.nextWeekFocus}
          </p>
        </div>
      )}
    </Card>
  );
}

export function WeeklyReviewSkeleton() {
  return (
    <Card>
      <h2 className="font-semibold">Your mentor&apos;s weekly review</h2>
      <p className="mt-2 animate-pulse text-sm text-slate-500">Your mentor is reviewing your week…</p>
    </Card>
  );
}
