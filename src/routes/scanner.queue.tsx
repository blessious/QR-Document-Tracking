import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge, PriorityBadge } from "@/components/common/StatusBadge";
import { useApp } from "@/store/app-store";
import { officeName } from "@/services/api";
import { relativeTime } from "@/lib/format";
import { useDeferredValue, useMemo, useState } from "react";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";

export const Route = createFileRoute("/scanner/queue")({
  component: QueuePage,
});

function QueuePage() {
  const { documents, session } = useApp();
  const officeId = session?.officeId ?? "off-accounting";
  const list = documents.filter(
    (d) =>
      d.currentOfficeId === officeId &&
      !["in_transit", "completed", "filed", "voided"].includes(d.status),
  );
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const filteredList = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return query
      ? list.filter((d) => `${d.trackingCode} ${d.title}`.toLowerCase().includes(query))
      : list;
  }, [deferredQ, list]);
  const pagination = useListPagination(filteredList, q);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Office queue</h1>
        <p className="text-sm text-muted-foreground">
          Everything currently logged to {officeName(officeId)}.
        </p>
      </div>
      <div className="flex justify-end">
        <ListSearch
          value={q}
          onChange={setQ}
          placeholder="Search office queue"
          ariaLabel="Search office queue"
        />
      </div>
      {filteredList.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Queue is empty"
          description="Received documents will show up here."
        />
      ) : (
        <>
          {pagination.pageItems.map((d) => (
            <Link key={d.id} to="/documents/$docId" params={{ docId: d.id }} className="block">
              <Card>
                <CardContent className="space-y-2 p-4 pt-4 sm:pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-xs text-muted-foreground">{d.trackingCode}</p>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="text-sm font-medium">{d.title}</p>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={d.priority} />
                    <span className="text-xs text-muted-foreground">
                      Updated {relativeTime(d.updatedAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          <ListPagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            pageSize={pagination.pageSize}
            totalItems={filteredList.length}
            itemLabel="queue documents"
            onPageChange={pagination.setPage}
          />
        </>
      )}
    </div>
  );
}
