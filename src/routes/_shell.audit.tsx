import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, userName } from "@/services/api";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/types";
import { PermissionGate } from "@/components/common/PermissionGate";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";

export const Route = createFileRoute("/_shell/audit")({
  head: () => ({
    meta: [
      { title: "Audit & security — LGU DocTrack" },
      {
        name: "description",
        content: "Immutable trail of user actions, sign-ins and configuration changes.",
      },
      { property: "og:title", content: "Audit & security — LGU DocTrack" },
      {
        property: "og:description",
        content: "Immutable trail of user actions and configuration changes.",
      },
    ],
  }),
  component: AuditPage,
});

const SEVERITY: Record<string, "default" | "secondary" | "destructive"> = {
  low: "secondary",
  medium: "default",
  high: "destructive",
};

function AuditPage() {
  const [q, setQ] = useState("");
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const deferredQ = useDeferredValue(q);
  useEffect(() => {
    void api.listAudit().then(setAuditEntries);
  }, []);
  const rows = useMemo(
    () =>
      auditEntries.filter((a) =>
        `${a.action} ${a.target} ${userName(a.actorId)}`
          .toLowerCase()
          .includes(deferredQ.trim().toLowerCase()),
      ),
    [auditEntries, deferredQ],
  );
  const pagination = useListPagination(rows, q);

  return (
    <PermissionGate roles={["admin"]}>
      <>
        <PageHeader
          title="Audit & security"
          description="Everything that happens in the system is recorded here."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Events (30 days)"
            value={1284}
            hint="All recorded actions"
            icon={ShieldCheck}
          />
          <StatCard
            label="Failed sign-ins"
            value={7}
            hint="3 from outside the LGU network"
            icon={ShieldAlert}
            tone="danger"
          />
          <StatCard
            label="Password resets"
            value={12}
            hint="Requested by office heads"
            icon={KeyRound}
            tone="warning"
          />
        </div>

        <Card>
          <CardHeader className="gap-3">
            <div>
              <CardTitle className="text-base">Audit trail</CardTitle>
              <CardDescription>Entries cannot be edited or deleted.</CardDescription>
            </div>
            <ListSearch
              value={q}
              onChange={setQ}
              placeholder="Search audit trail"
              ariaLabel="Search audit trail"
            />
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>IP address</TableHead>
                    <TableHead>Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{formatDateTime(a.timestamp)}</TableCell>
                      <TableCell className="text-sm">{userName(a.actorId)}</TableCell>
                      <TableCell className="font-mono text-xs">{a.action}</TableCell>
                      <TableCell className="text-sm">{a.target}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {a.ip}
                      </TableCell>
                      <TableCell>
                        <Badge variant={SEVERITY[a.severity]}>{a.severity}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No audit entries found.</p>
            ) : null}
            <ListPagination
              page={pagination.page}
              pageCount={pagination.pageCount}
              pageSize={pagination.pageSize}
              totalItems={rows.length}
              itemLabel="audit entries"
              onPageChange={pagination.setPage}
            />
          </CardContent>
        </Card>
      </>
    </PermissionGate>
  );
}
