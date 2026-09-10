import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/store/app-store";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { NotificationItem } from "@/types";
import { useDeferredValue, useMemo, useState } from "react";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";

export const Route = createFileRoute("/_shell/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — LGU DocTrack" },
      {
        name: "description",
        content: "Alerts for overdue documents, incoming dispatches and wrong-office scans.",
      },
      { property: "og:title", content: "Notifications — LGU DocTrack" },
      {
        property: "og:description",
        content: "Alerts for overdue documents and incoming dispatches.",
      },
    ],
  }),
  component: NotificationsPage,
});

const ICON: Record<NotificationItem["kind"], LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

const TONE: Record<NotificationItem["kind"], string> = {
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive/10 text-destructive",
};

function List({ items }: { items: NotificationItem[] }) {
  const { toggleRead } = useApp();
  if (items.length === 0) {
    return (
      <EmptyState icon={Bell} title="No notifications here" description="You are all caught up." />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((n) => {
        const Icon = ICON[n.kind];
        return (
          <Card key={n.id} className={n.read ? "opacity-70" : ""}>
            <CardContent className="flex items-start gap-3 p-4 pt-4 sm:gap-4 sm:pt-6">
              <span
                className={
                  "flex size-9 shrink-0 items-center justify-center rounded-full " + TONE[n.kind]
                }
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{relativeTime(n.timestamp)}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.timestamp)}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1 sm:pt-0.5">
                {n.documentId ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/documents/$docId" params={{ docId: n.documentId }}>
                      Open
                    </Link>
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => void toggleRead(n.id)}>
                  {n.read ? "Unread" : "Mark read"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function NotificationsPage() {
  const { notifications, markAllRead } = useApp();
  const unread = notifications.filter((n) => !n.read);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const filteredNotifications = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return query
      ? notifications.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(query))
      : notifications;
  }, [deferredQ, notifications]);
  const activeItems = activeTab === "all" ? filteredNotifications : filteredNotifications.filter((n) => !n.read);
  const pagination = useListPagination(activeItems, `${activeTab}|${q}`);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="System alerts about custody changes, SLA breaches and exceptions."
        actions={
          <Button variant="outline" onClick={() => void markAllRead()}>
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        }
      />
      <div className="flex justify-end">
        <ListSearch value={q} onChange={setQ} placeholder="Search notifications" ariaLabel="Search notifications" />
      </div>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "all" | "unread")}>
        <TabsList>
          <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unread.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <List items={pagination.pageItems} />
        </TabsContent>
        <TabsContent value="unread">
          <List items={pagination.pageItems} />
        </TabsContent>
      </Tabs>
      <ListPagination
        page={pagination.page}
        pageCount={pagination.pageCount}
        pageSize={pagination.pageSize}
        totalItems={activeItems.length}
        itemLabel="notifications"
        onPageChange={pagination.setPage}
      />
    </>
  );
}
