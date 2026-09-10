import { toast } from "sonner";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Clock, FileQuestion } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/services/api";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_shell/track")({
  head: () => ({
    meta: [
      { title: "Track a document — LGU DocTrack" },
      {
        name: "description",
        content: "Use a private public-tracking token to view a document's current status.",
      },
      { property: "og:title", content: "Track a document — LGU DocTrack" },
      {
        property: "og:description",
        content: "Use a private public-tracking token to view a document's current status.",
      },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const [code, setCode] = useState("");
  const [searched, setSearched] = useState(false);
  const [match, setMatch] = useState<Awaited<ReturnType<typeof api.publicTrack>> | null>(null);

  return (
    <>
      <PageHeader
        title="Track a document"
        description="Use the private public-tracking token supplied by the issuing office. No sign-in is required."
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
              placeholder="Public tracking token"
              aria-label="Public tracking token"
            />
            <Button type="submit">
              <Search className="size-4" /> Track
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Tracking codes and internal QR labels cannot be used on this public page.
          </p>
        </CardContent>
      </Card>

      {searched && !match ? (
        <EmptyState
          icon={FileQuestion}
          title="No tracking reference found"
          description="Double-check the reference on your routing slip, or contact the Records Management Section."
        />
      ) : null}

      {match ? (
        <div className="max-w-2xl">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{match.trackingReference}</CardTitle>
                <CardDescription>Public status only</CardDescription>
              </div>
              <Badge variant="secondary">{match.status.replaceAll("_", " ")}</Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg border border-border p-4">
                  <Clock className="mt-0.5 size-4 text-primary" aria-hidden />
                  <div>
                    <p className="text-xs text-muted-foreground">Last update</p>
                    <p className="text-sm font-medium">{formatDateTime(match.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
