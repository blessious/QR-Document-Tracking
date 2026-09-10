import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/services/api";
import { useApp } from "@/store/app-store";
import { PageHeader } from "@/components/common/PageHeader";
import { PermissionGate } from "@/components/common/PermissionGate";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
export const Route = createFileRoute("/_shell/reports")({ component: ReportsPage });
function ReportsPage() {
  const { offices, session } = useApp();
  const [template, setTemplate] = useState("transmittal");
  const [office, setOffice] = useState(
    session?.role === "admin" ? "all" : (session?.officeId ?? "all"),
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<{
    columns: string[];
    rows: Record<string, string | number>[];
  }>({ columns: [], rows: [] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    fetch(api.reportUrl(template, "json", office, from, to), {
      credentials: "include",
      signal: abort.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Report unavailable.");
        setReport(data);
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setReport({ columns: [], rows: [] });
          setError(error.message);
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [template, office, from, to]);
  const filteredRows = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return query
      ? report.rows.filter((row) => Object.values(row).join(" ").toLowerCase().includes(query))
      : report.rows;
  }, [deferredQ, report.rows]);
  const pagination = useListPagination(filteredRows, `${template}|${office}|${from}|${to}|${q}`);
  return (
    <PermissionGate roles={["admin", "office_head"]}>
      <PageHeader
        title="Reports"
        description="Custody reports calculated from saved events. Date filters use UTC calendar dates."
      />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Report filters</CardTitle>
          <CardDescription>
            Choose a report and narrow the results by office or date.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:flex sm:flex-wrap sm:gap-4">
          <div className="min-w-0 sm:min-w-36">
            <Label htmlFor="report-type">Report</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger id="report-type" className="mt-2 sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["transmittal", "turnaround", "aging", "volume"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 sm:min-w-48">
            <Label htmlFor="report-office">Office</Label>
            <Select value={office} onValueChange={setOffice} disabled={session?.role !== "admin"}>
              <SelectTrigger id="report-office" className="mt-2 sm:w-48">
                <SelectValue placeholder="All offices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 sm:w-40">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="min-w-0 sm:w-40">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Transmittal uses dispatch dates; turnaround uses release dates; volume uses event dates;
        aging filters registration dates and shows documents overdue now.
      </p>
      <div className="flex justify-end">
        <ListSearch
          value={q}
          onChange={setQ}
          placeholder="Search report results"
          ariaLabel="Search report results"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={loading || !!error}
          onClick={() =>
            window.open(
              api.reportUrl(template, "csv", office, from, to),
              "_blank",
              "noopener,noreferrer",
            )
          }
        >
          Export CSV
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : loading ? (
        <p>Loading report…</p>
      ) : (
        <Card>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[42rem]">
                <TableHeader>
                  <TableRow>
                    {report.columns.map((column) => (
                      <TableHead key={column}>{column}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((row, i) => (
                    <TableRow key={i}>
                      {report.columns.map((column) => (
                        <TableCell key={column}>{row[column]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredRows.length === 0 ? (
              <p className="p-3 text-center text-muted-foreground">No report records found.</p>
            ) : null}
            <p className="p-3">{filteredRows.length} records</p>
            <ListPagination
              page={pagination.page}
              pageCount={pagination.pageCount}
              pageSize={pagination.pageSize}
              totalItems={filteredRows.length}
              itemLabel="report records"
              onPageChange={pagination.setPage}
            />
          </CardContent>
        </Card>
      )}
    </PermissionGate>
  );
}
