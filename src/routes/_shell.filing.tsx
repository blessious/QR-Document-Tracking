import { DocumentActions } from "@/components/common/DocumentActions";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { docTypeName, officeName } from "@/services/api";
import { useApp } from "@/store/app-store";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, Boxes, FolderArchive } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";

export const Route = createFileRoute("/_shell/filing")({
  head: () => ({
    meta: [
      { title: "Filing & archives — LGU DocTrack" },
      {
        name: "description",
        content: "Assign physical file locations and manage completed documents.",
      },
      { property: "og:title", content: "Filing & archives — LGU DocTrack" },
      {
        property: "og:description",
        content: "Assign physical file locations for completed documents.",
      },
    ],
  }),
  component: FilingPage,
});

function FilingPage() {
  const { documents, fileDocument } = useApp();
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState<Record<string, string>>({});
  const deferredQ = useDeferredValue(q);
  const filed = documents.filter((d) => d.status === "filed");
  const pending = documents.filter((d) => d.status === "completed");
  const matchesQuery = (d: (typeof documents)[number]) =>
    `${d.trackingCode} ${d.title} ${d.fileLocation}`
      .toLowerCase()
      .includes(deferredQ.trim().toLowerCase());
  const filteredPending = useMemo(() => pending.filter(matchesQuery), [pending, deferredQ]);
  const results = useMemo(() => filed.filter(matchesQuery), [filed, deferredQ]);
  const pendingPagination = useListPagination(filteredPending, `pending|${q}`);
  const archivePagination = useListPagination(results, `archive|${q}`);

  return (
    <>
      <PageHeader
        title="Filing & archives"
        description="Give every completed document a physical home."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Archived"
          value={filed.length}
          hint="With assigned file location"
          icon={Archive}
        />
        <StatCard
          label="Awaiting filing"
          value={pending.length}
          hint="Completed but unfiled"
          icon={FolderArchive}
          tone="warning"
        />
        <StatCard
          label="File locations"
          value={new Set(filed.map((d) => d.fileLocation).filter(Boolean)).size}
          hint="Distinct recorded locations"
          icon={Boxes}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Awaiting filing</CardTitle>
          <CardDescription>Completed documents that still need a shelf location.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredPending.length === 0 ? (
            <EmptyState
              icon={FolderArchive}
              title="Everything is filed"
              description="No completed documents are waiting for a location."
            />
          ) : (
            pendingPagination.pageItems.map((d) => (
              <div
                key={d.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{d.trackingCode}</p>
                </div>
                <DocumentActions doc={d} />
              </div>
            ))
          )}
          <ListPagination
            page={pendingPagination.page}
            pageCount={pendingPagination.pageCount}
            pageSize={pendingPagination.pageSize}
            totalItems={filteredPending.length}
            itemLabel="pending documents"
            onPageChange={pendingPagination.setPage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle className="text-base">Archive index</CardTitle>
            <CardDescription>
              Search the physical archive by code, title or location.
            </CardDescription>
          </div>
          <ListSearch
            value={q}
            onChange={setQ}
            placeholder="Search filing records"
            ariaLabel="Search filing records"
          />
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivePagination.pageItems.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        to="/documents/$docId"
                        params={{ docId: d.id }}
                        className="text-primary hover:underline"
                      >
                        {d.trackingCode}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[20rem] truncate">{d.title}</TableCell>
                    <TableCell className="text-sm">{d.typeName ?? docTypeName(d.typeId)}</TableCell>
                    <TableCell className="text-sm">{d.fileLocation ?? "—"}</TableCell>
                    <TableCell className="text-sm">{formatDate(d.updatedAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {results.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No archived documents match “{q}”.
            </p>
          ) : null}
          <ListPagination
            page={archivePagination.page}
            pageCount={archivePagination.pageCount}
            pageSize={archivePagination.pageSize}
            totalItems={results.length}
            itemLabel="archived documents"
            onPageChange={archivePagination.setPage}
          />
        </CardContent>
      </Card>
    </>
  );
}
