import { createFileRoute, Link } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowUpRight, Inbox, PackageCheck, Send, Timer } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge, PriorityBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/store/app-store";
import { officeName } from "@/services/api";
import { formatDate, relativeTime } from "@/lib/format";
import type { TrackedDocument } from "@/types";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";

export const Route = createFileRoute("/_shell/office")({
  head: () => ({
    meta: [
      { title: "Office dashboard — LGU DocTrack" },
      {
        name: "description",
        content: "Documents in your custody, expected arrivals and outgoing dispatches.",
      },
      { property: "og:title", content: "Office dashboard — LGU DocTrack" },
      {
        property: "og:description",
        content: "Documents in your custody, expected arrivals and outgoing dispatches.",
      },
    ],
  }),
  component: OfficeDashboard,
});

function DocRow({ doc }: { doc: TrackedDocument }) {
  return (
    <Link
      to="/documents/$docId"
      params={{ docId: doc.id }}
      className="flex items-start gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{doc.trackingCode}</span>
          <PriorityBadge priority={doc.priority} />
        </div>
        <p className="mt-1 truncate text-sm font-medium">{doc.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          From {officeName(doc.originOfficeId)} · due {formatDate(doc.dueAt)} · updated{" "}
          {relativeTime(doc.updatedAt)}
        </p>
      </div>
      <span className="shrink-0">
        <StatusBadge status={doc.status} />
      </span>
    </Link>
  );
}

type OfficeTab = "custody" | "incoming" | "outgoing" | "released";

function OfficeDashboard() {
  const { documents, session } = useApp();
  const officeId = session?.officeId ?? "off-accounting";
  const inCustody = documents.filter(
    (d) =>
      d.currentOfficeId === officeId &&
      !["completed", "filed", "in_transit", "voided"].includes(d.status),
  );
  const incoming = documents.filter(
    (d) => d.nextOfficeId === officeId && d.status === "in_transit",
  );
  const outgoing = documents.filter(
    (d) => d.currentOfficeId === officeId && d.status === "in_transit",
  );
  const released = documents.filter(
    (d) => d.currentOfficeId === officeId && ["completed", "filed"].includes(d.status),
  );
  const [activeTab, setActiveTab] = useState<OfficeTab>("custody");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const lists = useMemo(
    () => ({ custody: inCustody, incoming, outgoing, released }) as const,
    [inCustody, incoming, outgoing, released],
  );
  const filteredLists = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    if (!query) return lists;
    return Object.fromEntries(
      Object.entries(lists).map(([key, list]) => [
        key,
        list.filter((d) =>
          `${d.trackingCode} ${d.title} ${d.requester}`.toLowerCase().includes(query),
        ),
      ]),
    ) as typeof lists;
  }, [deferredQ, lists]);
  const activeList = filteredLists[activeTab];
  const pagination = useListPagination(activeList, `${activeTab}|${q}`);

  return (
    <>
      <PageHeader
        title={officeName(officeId)}
        description="Your office worklist — what is in your custody, what is arriving and what you have released."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/incoming">
                <Inbox className="size-4" /> Expected incoming
              </Link>
            </Button>
            <Button asChild>
              <Link to="/scanner">
                <Send className="size-4" /> Receive / dispatch
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="In custody"
          value={inCustody.length}
          hint="Awaiting action by your office"
          icon={PackageCheck}
        />
        <StatCard
          label="Expected today"
          value={incoming.length}
          hint="Dispatched to you"
          icon={Inbox}
          tone="warning"
        />
        <StatCard
          label="Outgoing"
          value={outgoing.length}
          hint="In transit from your office"
          icon={ArrowUpRight}
        />
        <StatCard
          label="Avg. handling"
          value="—"
          hint="Handling metrics not yet calculated"
          icon={Timer}
          tone="success"
        />
      </div>

      <div className="flex justify-end">
        <ListSearch
          value={q}
          onChange={setQ}
          placeholder="Search office documents"
          ariaLabel="Search office documents"
        />
      </div>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as OfficeTab)}>
        <TabsList>
          <TabsTrigger value="custody">In custody ({inCustody.length})</TabsTrigger>
          <TabsTrigger value="incoming">Incoming ({incoming.length})</TabsTrigger>
          <TabsTrigger value="outgoing">Outgoing ({outgoing.length})</TabsTrigger>
          <TabsTrigger value="released">Released ({released.length})</TabsTrigger>
        </TabsList>
        {(
          [
            [
              "custody",
              inCustody,
              "Nothing in your custody",
              "Documents you receive will appear here.",
            ],
            [
              "incoming",
              incoming,
              "No expected arrivals",
              "Offices have not dispatched anything to you yet.",
            ],
            [
              "outgoing",
              outgoing,
              "No outgoing documents",
              "Dispatch a document from the scanner to see it here.",
            ],
            [
              "released",
              released,
              "Nothing released yet",
              "Completed and filed documents appear here.",
            ],
          ] as const
        ).map(([key, list, title, desc]) => (
          <TabsContent key={key} value={key} className="space-y-3">
            {filteredLists[key].length === 0 ? (
              <EmptyState
                icon={Inbox}
                title={q ? "No matching documents" : title}
                description={q ? "Try a different search term." : desc}
              />
            ) : key === activeTab ? (
              pagination.pageItems.map((d) => <DocRow key={d.id} doc={d} />)
            ) : null}
            {key === activeTab ? (
              <ListPagination
                page={pagination.page}
                pageCount={pagination.pageCount}
                pageSize={pagination.pageSize}
                totalItems={filteredLists[key].length}
                itemLabel="documents"
                onPageChange={pagination.setPage}
              />
            ) : null}
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Office reminders</CardTitle>
          <CardDescription>
            Standing instructions configured by the records administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            • Scan every incoming document at the receiving window before physically accepting it.
          </p>
          <p>
            • Disbursement vouchers must carry a budget certification before forwarding to Treasury.
          </p>
          <p>
            • Review held documents regularly and contact the responsible office when follow-up is
            needed.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
