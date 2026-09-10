import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoadingPageSkeletonProps = {
  variant?: "shell" | "scanner" | "content";
};

const NAV_GROUPS = [
  ["w-24", "w-32", "w-28"],
  ["w-28", "w-36", "w-24", "w-32"],
  ["w-24", "w-28", "w-20"],
  ["w-20", "w-28", "w-24"],
];

function ContentSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6" aria-hidden="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="mt-5 h-8 w-20" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/70 p-5">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="space-y-5 p-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="size-9 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="hidden h-7 w-20 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen min-h-[100svh] overflow-hidden bg-background">
      <aside className="hidden w-[17rem] shrink-0 border-r border-sidebar-border lg:block">
        <div className="flex h-full min-h-screen flex-col bg-sidebar p-4">
          <div className="flex items-center gap-3 px-1 py-1">
            <Skeleton className="size-9 shrink-0 rounded-xl bg-sidebar-accent" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-28 bg-sidebar-accent" />
              <Skeleton className="h-2.5 w-24 bg-sidebar-accent/80" />
            </div>
          </div>
          <Skeleton className="mt-7 h-9 w-full rounded-lg bg-sidebar-accent" />

          <div className="mt-7 flex-1 space-y-7" aria-hidden="true">
            {NAV_GROUPS.map((items, groupIndex) => (
              <div key={groupIndex} className="space-y-3">
                <Skeleton className="ml-3 h-2.5 w-20 bg-sidebar-accent/80" />
                <div className="space-y-2">
                  {items.map((width, itemIndex) => (
                    <div key={itemIndex} className="flex items-center gap-3 px-3">
                      <Skeleton className="size-4 rounded bg-sidebar-accent" />
                      <Skeleton className={cn("h-3 bg-sidebar-accent", width)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-lg bg-sidebar-accent" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center gap-3 border-b border-border/80 px-3 sm:px-6 lg:px-8">
          <Skeleton className="size-9 rounded-lg lg:hidden" />
          <Skeleton className="hidden size-9 rounded-lg lg:block" />
          <Skeleton className="hidden h-4 w-44 md:block" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="hidden h-9 w-52 rounded-lg sm:block" />
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-7 lg:px-8">
          <ContentSkeleton />
        </main>
      </div>
    </div>
  );
}

function ScannerSkeleton() {
  return (
    <div className="flex min-h-screen min-h-[100svh] flex-col bg-muted/30">
      <header className="flex min-h-14 items-center gap-3 border-b border-border/80 bg-background px-3 sm:px-6">
        <Skeleton className="size-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-2.5 w-24" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="hidden h-9 w-20 rounded-lg sm:block" />
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-5 sm:px-6 lg:py-8">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
            <Skeleton className="mx-auto aspect-square w-full max-w-sm rounded-2xl" />
            <div className="mt-6 space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </main>
      <div className="h-16 border-t border-border/80 bg-background lg:hidden" />
    </div>
  );
}

function ContentOnlySkeleton() {
  return (
    <div className="space-y-4 p-1" aria-hidden="true">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

export function LoadingPageSkeleton({ variant = "shell" }: LoadingPageSkeletonProps) {
  return (
    <div role="status" aria-label="Loading page" aria-busy="true">
      {variant === "scanner" ? <ScannerSkeleton /> : null}
      {variant === "content" ? <ContentOnlySkeleton /> : null}
      {variant === "shell" ? <ShellSkeleton /> : null}
      <span className="sr-only">Loading page…</span>
    </div>
  );
}
