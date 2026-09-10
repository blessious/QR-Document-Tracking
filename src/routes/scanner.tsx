import { ROLE_HOME } from "@/lib/permissions";
import { LoadingPageSkeleton } from "@/components/common/LoadingPageSkeleton";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { cn } from "@/lib/utils";
import { officeName } from "@/services/api";
import { useApp } from "@/store/app-store";
import { Outlet, createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Inbox, LogOut, QrCode, Send, ScanLine } from "lucide-react";
import { LoginPage } from "./index";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Mobile scanner — LGU DocTrack" },
      {
        name: "description",
        content: "Handheld receiving and dispatch station for QR-labelled documents.",
      },
      { property: "og:title", content: "Mobile scanner — LGU DocTrack" },
      {
        property: "og:description",
        content: "Handheld receiving and dispatch station for QR-labelled documents.",
      },
    ],
  }),
  component: ScannerLayout,
});

const TABS = [
  { to: "/scanner", label: "Scan", icon: ScanLine },
  { to: "/scanner/receive", label: "Receive", icon: QrCode },
  { to: "/scanner/dispatch", label: "Dispatch", icon: Send },
  { to: "/scanner/queue", label: "Queue", icon: Inbox },
];

function ScannerLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, loading, logout } = useApp();
  if (loading) return <LoadingPageSkeleton variant="scanner" />;
  if (!session) return <LoginPage />;
  const backTo = session.role === "receiving" ? "/scanner" : ROLE_HOME[session.role];

  return (
    <div className="flex min-h-screen min-h-[100svh] flex-col bg-muted/30">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 text-foreground shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center gap-2 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 sm:gap-3 sm:px-6 sm:py-3">
          <Link
            to={backTo}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Back to desktop app"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">Receiving station</p>
            <p className="truncate text-xs text-muted-foreground">
              {officeName(session?.officeId ?? "off-accounting")}
            </p>
          </div>

          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {TABS.map((t) => {
              const active = pathname === t.to;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <t.icon className="size-4" aria-hidden />
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <button
            className="ml-auto hidden shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:inline-flex"
            onClick={() => void logout()}
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
          <ThemeToggle />
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/15">
            {session?.avatarInitials ?? "JS"}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 pb-24 sm:px-6 lg:py-8 lg:pb-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((t) => {
            const active = pathname === t.to;
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <t.icon className="size-5" aria-hidden />
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
