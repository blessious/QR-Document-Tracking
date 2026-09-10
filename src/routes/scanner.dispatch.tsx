import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/store/app-store";
import { DocumentActions } from "@/components/common/DocumentActions";
import { EmptyState } from "@/components/common/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { FileUp } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";
export const Route = createFileRoute("/scanner/dispatch")({ component: DispatchPage });
function DispatchPage() {
  const { documents, session } = useApp();
  const list = documents.filter(
    (d) =>
      d.currentOfficeId === session?.officeId &&
      ["registered", "received", "in_process", "returned"].includes(d.status),
  );
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const filteredList = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return query
      ? list.filter((doc) => `${doc.trackingCode} ${doc.title}`.toLowerCase().includes(query))
      : list;
  }, [deferredQ, list]);
  const pagination = useListPagination(filteredList, q);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dispatch documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a document that is ready to move to its next office.
        </p>
      </div>
      <div className="flex justify-end">
        <ListSearch
          value={q}
          onChange={setQ}
          placeholder="Search dispatch queue"
          ariaLabel="Search dispatch queue"
        />
      </div>
      {!filteredList.length ? (
        <EmptyState
          icon={FileUp}
          title="No documents ready to dispatch"
          description="Documents in your custody will appear here when they can move forward."
        />
      ) : (
        <>
          {pagination.pageItems.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="space-y-3 p-4 sm:p-5">
                <p className="text-sm font-medium">
                  <span className="font-mono text-xs text-muted-foreground">
                    {doc.trackingCode}
                  </span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  {doc.title}
                </p>
                <DocumentActions doc={doc} />
              </CardContent>
            </Card>
          ))}
          <ListPagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            pageSize={pagination.pageSize}
            totalItems={filteredList.length}
            itemLabel="dispatch documents"
            onPageChange={pagination.setPage}
          />
        </>
      )}
    </div>
  );
}
