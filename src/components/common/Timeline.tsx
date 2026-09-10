import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  FileInput,
  FilePlus2,
  FolderArchive,
  PauseCircle,
  Undo2,
  XCircle,
  Cog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TrackingEvent } from "@/types";
import { officeName, userName } from "@/services/api";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";

const ICON: Record<TrackingEvent["action"], LucideIcon> = {
  registered: FilePlus2,
  dispatched: ArrowRight,
  received: FileInput,
  processed: Cog,
  held: PauseCircle,
  returned: Undo2,
  completed: CheckCircle2,
  filed: FolderArchive,
  wrong_office: AlertTriangle,
  voided: XCircle,
};

const LABEL: Record<TrackingEvent["action"], string> = {
  registered: "Registered",
  dispatched: "Dispatched",
  received: "Received",
  processed: "Processed",
  held: "Placed on hold",
  returned: "Returned",
  completed: "Completed",
  filed: "Filed",
  wrong_office: "Wrong office scan",
  voided: "Voided",
};

const TERMINAL_ACTIONS: TrackingEvent["action"][] = ["completed", "filed", "voided"];

export function Timeline({
  events,
  officeNames,
}: {
  events: TrackingEvent[];
  officeNames?: Record<string, string> | undefined;
}) {
  const ordered = [...events].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));

  if (ordered.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">No custody events yet.</p>;
  }

  return (
    <ol
      aria-label="Custody timeline"
      className="relative flex w-full max-w-2xl flex-col gap-6 py-8"
    >
      {ordered.map((event, index) => {
        const Icon = ICON[event.action];
        const danger =
          event.action === "wrong_office" ||
          event.action === "returned" ||
          event.action === "voided";
        const isLatest = index === ordered.length - 1;
        const status =
          isLatest && !TERMINAL_ACTIONS.includes(event.action) ? "in-progress" : "completed";
        const destination = event.toOfficeId
          ? (officeNames?.[event.toOfficeId] ?? officeName(event.toOfficeId))
          : "No destination recorded";
        const origin = event.fromOfficeId
          ? (officeNames?.[event.fromOfficeId] ?? officeName(event.fromOfficeId))
          : null;

        return (
          <li
            key={event.id}
            className="timeline-item-enter relative"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="grid grid-cols-[minmax(4.75rem,0.75fr)_auto_minmax(0,2fr)] items-stretch gap-3 sm:gap-4">
              <div className="flex flex-col justify-start pt-1 text-right">
                <time
                  dateTime={new Date(event.timestamp).toISOString()}
                  className="text-sm font-medium tracking-tight text-muted-foreground"
                >
                  {formatDate(event.timestamp)}
                </time>
                <span className="text-xs text-muted-foreground/75">
                  {new Date(event.timestamp).toLocaleTimeString("en-PH", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <div className="flex h-full flex-col items-center">
                <span
                  aria-label={`${LABEL[event.action]} status`}
                  className={
                    "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ring-8 ring-background shadow-sm " +
                    (danger
                      ? "bg-destructive text-destructive-foreground"
                      : status === "in-progress"
                        ? "bg-primary text-primary-foreground"
                        : "bg-success text-primary-foreground")
                  }
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {index < ordered.length - 1 ? (
                  <span
                    aria-hidden
                    className={
                      "mt-2 min-h-12 w-0.5 flex-1 " +
                      (danger
                        ? "bg-destructive/40"
                        : status === "in-progress"
                          ? "bg-gradient-to-b from-primary to-muted"
                          : "bg-primary")
                    }
                  />
                ) : null}
              </div>

              <div
                className={
                  "min-w-0 pb-1 pl-1 " + (event.action === "wrong_office" ? "text-destructive" : "")
                }
                {...(status === "in-progress" ? { "aria-current": "step" as const } : {})}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="font-semibold leading-tight tracking-tight text-foreground">
                    {LABEL[event.action]}
                  </h3>
                  <span className="text-xs font-medium text-muted-foreground">
                    {relativeTime(event.timestamp)}
                  </span>
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  {origin ? (
                    <>
                      {origin} <span className="px-1 text-foreground/50">→</span>
                    </>
                  ) : null}
                  {destination}
                </p>

                {event.remarks ? (
                  <p className="mt-2 max-w-sm text-sm italic text-foreground/80">
                    “{event.remarks}”
                  </p>
                ) : null}

                <p className="mt-2 text-xs text-muted-foreground">
                  {event.actorName ?? userName(event.actorId)} · {formatDateTime(event.timestamp)}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
