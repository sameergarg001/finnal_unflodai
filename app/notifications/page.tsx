import Link from "next/link";
import { after } from "next/server";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { getNotifications } from "@/server/services/notifications";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireReadyUser();
  const { items } = await getNotifications(user.id);
  const seen = user.profile?.notificationsSeenAt?.getTime() ?? 0;
  // Opening the list marks everything as seen.
  after(() => db.userProfile.update({ where: { userId: user.id }, data: { notificationsSeenAt: new Date() } }));

  return (
    <AppShell title="Notifications" back="/dashboard">
      {items.length === 0 ? (
        <EmptyState icon="🔔" title="You're all caught up" body="Reminders about active tasks and reports will show up here." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Link key={n.id} href={n.href} className="flex gap-3 rounded-3xl border border-line bg-card p-4 active:scale-[0.99]">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.at.getTime() > seen ? "bg-accent" : "bg-transparent"}`} />
              <div className="min-w-0">
                <p className="font-semibold">{n.title}</p>
                <p className="mt-0.5 text-sm text-muted">{n.body}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="px-1 text-center text-xs text-muted"><Link href="/profile" className="underline">Notification settings</Link></p>
    </AppShell>
  );
}
