import { DocumentActions } from "@/components/common/DocumentActions";
import { EmptyState } from "@/components/common/EmptyState";
import { PriorityBadge } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { relativeTime } from "@/lib/format";
import { officeName } from "@/services/api";
import { useApp } from "@/store/app-store";
import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";

export const Route = createFileRoute("/scanner/receive")({
  component: ReceivePage,
});

function ReceivePage() {
  const { documents, session, receiveDocument } = useApp();
  const officeId = session?.officeId ?? "off-accounting";
  const list = documents.filter((d) => d.nextOfficeId === officeId && d.status === "in_transit");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const filteredList = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return query
      ? list.filter((d) => `${d.trackingCode} ${d.title} ${officeName(d.currentOfficeId)}`.toLowerCase().includes(query))
      : list;
  }, [deferredQ, list]);
  const pagination = useListPagination(filteredList, q);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Receive documents</h1>
        <p className="text-sm text-muted-foreground">
          Everything dispatched to {officeName(officeId)}.
        </p>
      </div>
      <div className="flex justify-end">
        <ListSearch value={q} onChange={setQ} placeholder="Search receive queue" ariaLabel="Search receive queue" />
      </div>
      {filteredList.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing to receive"
          description="Scan a routing slip when a document arrives."
        />
      ) : (
        <>
        {pagination.pageItems.map((d) => (
          <Card key={d.id}>
            <CardContent className="space-y-3 p-4 pt-4 sm:pt-6">
              <p className="font-mono text-xs text-muted-foreground">{d.trackingCode}</p>
              <p className="text-sm font-medium">{d.title}</p>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={d.priority} />
                <span className="text-xs text-muted-foreground">
                  From {officeName(d.currentOfficeId)} · {relativeTime(d.updatedAt)}
                </span>
              </div>
              <DocumentActions doc={d} />
            </CardContent>
          </Card>
        ))}
        <ListPagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          totalItems={filteredList.length}
          itemLabel="incoming documents"
          onPageChange={pagination.setPage}
        />
        </>
      )}
    </div>
  );
}
