import { cn } from "@/lib/utils";
import type { DocumentStatus, Priority } from "@/types";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  registered: "Registered",
  in_transit: "In transit",
  received: "Received",
  in_process: "In process",
  on_hold: "On hold",
  returned: "Returned",
  completed: "Completed",
  filed: "Filed",
  voided: "Voided",
};

const STATUS_CLASS: Record<DocumentStatus, string> = {
  registered: "bg-muted text-muted-foreground border-border",
  in_transit: "bg-info-soft text-info border-info/30",
  received: "bg-primary/10 text-primary border-primary/25",
  in_process: "bg-primary/10 text-primary border-primary/25",
  on_hold: "bg-warning-soft text-warning border-warning/30",
  returned: "bg-destructive/10 text-destructive border-destructive/25",
  completed: "bg-success-soft text-success border-success/30",
  filed: "bg-secondary text-secondary-foreground border-border",
  voided: "bg-destructive/10 text-destructive border-destructive/25",
};

export function StatusBadge({ status, className }: { status: DocumentStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_CLASS[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_CLASS: Record<Priority, string> = {
  routine: "bg-muted text-muted-foreground border-border",
  urgent: "bg-warning-soft text-warning border-warning/30",
  rush: "bg-destructive/10 text-destructive border-destructive/30",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        PRIORITY_CLASS[priority],
      )}
    >
      {priority}
    </span>
  );
}

export { STATUS_LABEL };
