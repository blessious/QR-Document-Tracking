import { toast } from "sonner";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, MapPin, Clock, FileQuestion } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Timeline } from "@/components/common/Timeline";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { QrPlaceholder } from "@/components/common/QrPlaceholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApp } from "@/store/app-store";
import { api, docTypeName, officeName } from "@/services/api";
import { formatDateTime } from "@/lib/format";
import type { TrackedDocument } from "@/types";

export const Route = createFileRoute("/_shell/track")({
  head: () => ({
    meta: [
      { title: "Track a document — LGU DocTrack" },
      {
        name: "description",
        content: "Enter a tracking or QR reference code to see where a document currently sits.",
      },
      { property: "og:title", content: "Track a document — LGU DocTrack" },
      {
        property: "og:description",
        content: "Enter a tracking or QR reference code to locate a document.",
      },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const { documents } = useApp();
  const [code, setCode] = useState("");
  const [searched, setSearched] = useState(false);
  const [match, setMatch] = useState<
    (TrackedDocument & { officeNames?: Record<string, string>; typeName?: string }) | null
  >(null);

  return (
    <>
      <PageHeader
        title="Track a document"
        description="Look up any document by its printed tracking code or QR reference. No sign-in required."
      />

      <Card className="max-w-2xl">
        <CardContent className="p-6">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={async (e) => {
              e.preventDefault();
              setSearched(true);
              try {
                setMatch(await api.publicTrack(code.trim()));
              } catch (error) {
                setMatch(null);
                toast.error(
                  error instanceof Error ? error.message : "Tracking service unavailable.",
                );
              }
            }}
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. LGU-2026-000418 or QR-000418"
              aria-label="Tracking code"
            />
            <Button type="submit">
              <Search className="size-4" /> Track
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Use the code printed on your routing slip.
          </p>
        </CardContent>
      </Card>

      {searched && !match ? (
        <EmptyState
          icon={FileQuestion}
          title="No document found for that code"
          description="Double-check the reference on your routing slip, or contact the Records Management Section."
        />
      ) : null}

      {match ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{match.title}</CardTitle>
                <CardDescription>
                  {match.trackingCode} · {match.typeName ?? docTypeName(match.typeId)}
                </CardDescription>
              </div>
              <StatusBadge status={match.status} />
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg border border-border p-4">
                  <MapPin className="mt-0.5 size-4 text-primary" aria-hidden />
                  <div>
                    <p className="text-xs text-muted-foreground">Currently at</p>
                    <p className="text-sm font-medium">
                      {match.officeNames?.[match.currentOfficeId] ??
                        officeName(match.currentOfficeId)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border p-4">
                  <Clock className="mt-0.5 size-4 text-primary" aria-hidden />
                  <div>
                    <p className="text-xs text-muted-foreground">Last update</p>
                    <p className="text-sm font-medium">{formatDateTime(match.updatedAt)}</p>
                  </div>
                </div>
              </div>
              <Timeline events={match.events} officeNames={match.officeNames} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reference label</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <QrPlaceholder value={match.qrCode} size={150} />
              <p className="font-mono text-sm">{match.qrCode}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
