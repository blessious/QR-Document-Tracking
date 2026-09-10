import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="relative min-h-32 p-5 sm:p-6">
        <div className="min-w-0 pr-7">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            {value}
          </p>
          {hint ? <p className="mt-1 truncate text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        <span className={cn("absolute right-5 top-5 sm:right-6 sm:top-6", toneClass)}>
          <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
}
