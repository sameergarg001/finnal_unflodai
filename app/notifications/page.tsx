import Link from "next/link";
import { after } from "next/server";
import { db } from "@/lib/db";
import { requireReadyUser } from "@/server/auth/session";
import { getNotifications } from "@/server/services/notifications";
import { AppShell } from "@/components/AppShell";
import { EmptyState, Icon } from "@/components/ui";

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
        <EmptyState icon="🔔" title="All caught up" body="Task reminders will show up here." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Link key={n.id} href={n.href} className="glass flex items-start gap-3.5 rounded-[24px] p-4 active:scale-[0.99]">
              <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${n.at.getTime() > seen ? "bg-sun-soft text-sun-ink" : "bg-card-2 text-muted"}`}>
                <Icon name="bell" className="h-[18px] w-[18px]" />
                {n.at.getTime() > seen && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-sun ring-2 ring-card-solid" />}
              </span>
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
