import { DocumentActions } from "@/components/common/DocumentActions";
import { BarcodePlaceholder } from "@/components/common/BarcodePlaceholder";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { QrPlaceholder } from "@/components/common/QrPlaceholder";
import { PriorityBadge, StatusBadge } from "@/components/common/StatusBadge";
import { Timeline } from "@/components/common/Timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import { api, docTypeName, officeName, userName } from "@/services/api";
import { useApp } from "@/store/app-store";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Download, FileText, FolderArchive, Printer } from "lucide-react";

export const Route = createFileRoute("/_shell/documents/$docId")({
  head: () => ({
    meta: [
      { title: "Document details — LGU DocTrack" },
      {
        name: "description",
        content: "Custody timeline and routing actions for a tracked document.",
      },
      { property: "og:title", content: "Document details — LGU DocTrack" },
      {
        property: "og:description",
        content: "Custody timeline and routing actions.",
      },
    ],
  }),
  component: DocumentDetail,
});

function DocumentDetail() {
  const { docId } = useParams({ from: "/_shell/documents/$docId" });
  const { documents, session } = useApp();
  const doc = documents.find((d) => d.id === docId);

  if (!doc) {
    return (
      <EmptyState
        icon={FolderArchive}
        title="Document not found"
        description="It may have been archived or the tracking code is incorrect."
        action={
          <Button asChild>
            <Link to="/documents">Back to registry</Link>
          </Button>
        }
      />
    );
  }

  // During transit, custody remains recorded at the sending office until the
  // destination receives the physical document. Only the destination gets a
  // receive action in that state; the sending office must not see controls.
  const canReceive = doc.status === "in_transit" && doc.nextOfficeId === session?.officeId;
  const canManage = doc.status !== "in_transit" && session?.officeId === doc.currentOfficeId;
  const showRoutingActions = canReceive || canManage;

  return (
    <>
      <PageHeader
        title={doc.title}
        description={`${doc.trackingCode} · ${doc.typeName ?? docTypeName(doc.typeId)} · filed by ${userName(doc.createdBy)}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/documents">
                <ArrowLeft className="size-4" /> Registry
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                window.open(api.routingSlipUrl(doc.id), "_blank", "noopener,noreferrer")
              }
            >
              <Printer className="size-4" /> Reprint slip
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Current state</CardTitle>
                <CardDescription>{doc.subject}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <PriorityBadge priority={doc.priority} />
                <StatusBadge status={doc.status} />
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Current office</dt>
                  <dd className="font-medium">{officeName(doc.currentOfficeId)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Next office</dt>
                  <dd className="font-medium">{officeName(doc.nextOfficeId)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Origin</dt>
                  <dd className="font-medium">{officeName(doc.originOfficeId)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Requester</dt>
                  <dd className="font-medium">{doc.requester}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Registered</dt>
                  <dd className="font-medium">{formatDateTime(doc.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Target completion</dt>
                  <dd className="font-medium">{formatDateTime(doc.dueAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Pages</dt>
                  <dd className="font-medium">{doc.pageCount}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Remarks</dt>
                  <dd className="font-medium">{doc.remarks ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Custody timeline</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline">
              <Card>
                <CardContent className="p-6">
                  <Timeline events={doc.events} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="attachments">
              <Card>
                <CardContent className="p-6">
                  {doc.attachments.length ? (
                    <div className="space-y-3">
                      {doc.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                              <FileText className="size-4" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {(attachment.size / 1024).toFixed(1)} KB · Uploaded{" "}
                                {formatDateTime(attachment.createdAt)}
                              </p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={api.attachmentUrl(doc.id, attachment.id)} download>
                              <Download className="size-4" /> Download
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={FolderArchive}
                      title="No document uploaded"
                      description="This tracking slip was created without an uploaded document."
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">QR and barcode references</CardTitle>
              <CardDescription>Attach this label to the physical folder.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <QrPlaceholder value={doc.qrCode} size={120} />
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-sm font-semibold">{doc.qrCode}</p>
                  <p className="font-mono text-xs text-muted-foreground">{doc.trackingCode}</p>
                </div>
              </div>
              <BarcodePlaceholder value={doc.trackingCode} />
            </CardContent>
          </Card>

          {showRoutingActions ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Routing actions</CardTitle>
                <CardDescription>Actions update the custody log immediately.</CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentActions key={doc.id} doc={doc} />{" "}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
