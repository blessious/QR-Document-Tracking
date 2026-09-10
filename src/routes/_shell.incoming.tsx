import { DocumentActions } from "@/components/common/DocumentActions";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { PriorityBadge, StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime, relativeTime } from "@/lib/format";
import { officeName } from "@/services/api";
import { useApp } from "@/store/app-store";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox, QrCode, TruckIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";

export const Route = createFileRoute("/_shell/incoming")({
  head: () => ({
    meta: [
      { title: "Expected incoming — LGU DocTrack" },
      {
        name: "description",
        content: "Documents dispatched to your office and awaiting receipt at the window.",
      },
      { property: "og:title", content: "Expected incoming — LGU DocTrack" },
      {
        property: "og:description",
        content: "Documents dispatched to your office awaiting receipt.",
      },
    ],
  }),
  component: IncomingPage,
});

function IncomingPage() {
  const { documents, session, receiveDocument, offices } = useApp();
  const [officeId, setOfficeId] = useState(session?.officeId ?? "off-accounting");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const list = useMemo(
    () => documents.filter((d) => d.nextOfficeId === officeId && d.status === "in_transit"),
    [documents, officeId],
  );
  const filteredList = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return query
      ? list.filter((d) =>
          `${d.trackingCode} ${d.title} ${d.requester} ${officeName(d.currentOfficeId)}`
            .toLowerCase()
            .includes(query),
        )
      : list;
  }, [deferredQ, list]);
  const pagination = useListPagination(filteredList, `${officeId}|${q}`);

  return (
    <>
      <PageHeader
        title="Expected incoming"
        description="Documents other offices have dispatched to you. Confirm receipt when the physical copy arrives."
        actions={
          <Button asChild>
            <Link to="/scanner/receive">
              <QrCode className="size-4" /> Scan to receive
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Receiving office</CardTitle>
          <CardDescription>Switch offices to view another receiving queue.</CardDescription>
        </CardHeader>
        <CardContent className="max-w-sm">
          <Select value={officeId} onValueChange={setOfficeId} disabled={session?.role !== "admin"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {offices.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <ListSearch
          value={q}
          onChange={setQ}
          placeholder="Search incoming documents"
          ariaLabel="Search incoming documents"
        />
      </div>
      {filteredList.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing in transit to this office"
          description="Documents appear here after another office dispatches them; queues refresh every 10 seconds."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
          {pagination.pageItems.map((d) => (
            <Card key={d.id}>
              <CardHeader className="flex-col gap-2 space-y-0 pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{d.title}</CardTitle>
                  <CardDescription className="font-mono text-xs">{d.trackingCode}</CardDescription>
                </div>
                <StatusBadge status={d.status} />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TruckIcon className="size-4" aria-hidden />
                  From {officeName(d.currentOfficeId)} · dispatched {relativeTime(d.updatedAt)}
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={d.priority} />
                  <span className="text-xs text-muted-foreground">
                    Due {formatDateTime(d.dueAt)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DocumentActions doc={d} />
                  <Button variant="outline" asChild>
                    <Link to="/documents/$docId" params={{ docId: d.id }}>
                      Details
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
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
    </>
  );
}
