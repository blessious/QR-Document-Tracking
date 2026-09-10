import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  ChevronDown,
  FileText,
  FolderArchive,
  Inbox,
  LayoutDashboard,
  ListTree,
  LogOut,
  Menu,
  PanelLeft,
  QrCode,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useApp } from "@/store/app-store";
import { officeName } from "@/services/api";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
  keywords: string;
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      {
        to: "/dashboard",
        label: "Admin dashboard",
        icon: LayoutDashboard,
        roles: ["admin"],
        keywords: "home overview metrics workload sla",
      },
      {
        to: "/office",
        label: "My office",
        icon: Building2,
        roles: ["admin", "office_head", "staff"],
        keywords: "worklist custody assigned pending my department",
      },
      {
        to: "/incoming",
        label: "Expected incoming",
        icon: Inbox,
        roles: ["admin", "office_head", "staff"],
        keywords: "receive receiving arrivals transit dispatch queue",
      },
    ],
  },
  {
    label: "Documents",
    items: [
      {
        to: "/documents",
        label: "Document registry",
        icon: FileText,
        roles: ["admin", "office_head", "staff"],
        keywords: "documents records register find lookup qr tracking",
      },
      {
        to: "/documents/new",
        label: "Create tracking slip",
        icon: ClipboardList,
        roles: ["admin", "office_head", "staff"],
        keywords: "new register document create qr routing slip",
      },
      {
        to: "/track",
        label: "Public tracking",
        icon: Search,
        roles: ["admin", "office_head", "staff"],
        keywords: "track tracking status public lookup qr code",
      },
      {
        to: "/filing",
        label: "Filing & archives",
        icon: FolderArchive,
        roles: ["admin", "office_head", "staff"],
        keywords: "file archive archived storage completed records",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        to: "/offices",
        label: "Offices",
        icon: Building2,
        roles: ["admin"],
        keywords: "department directory routing destinations office management",
      },
      {
        to: "/users",
        label: "Users & roles",
        icon: Users,
        roles: ["admin"],
        keywords: "accounts staff permissions access login",
      },
      {
        to: "/references",
        label: "Document types",
        icon: ListTree,
        roles: ["admin", "office_head", "staff"],
        keywords: "reference master data categories document type priority actions",
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        to: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        roles: ["admin", "office_head"],
        keywords: "charts metrics bottlenecks turnaround sla performance",
      },
      {
        to: "/reports",
        label: "Reports",
        icon: FileText,
        roles: ["admin", "office_head"],
        keywords: "export csv summaries document reports",
      },
      {
        to: "/notifications",
        label: "Notifications",
        icon: Bell,
        roles: ["admin", "office_head", "staff"],
        keywords: "alerts messages overdue warnings",
      },
      {
        to: "/audit",
        label: "Audit & security",
        icon: ShieldCheck,
        roles: ["admin"],
        keywords: "activity history logs security sign in",
      },
      {
        to: "/settings",
        label: "Settings",
        icon: Settings,
        roles: ["admin"],
        keywords: "configuration preferences notifications sla system",
      },
    ],
  },
];

function initials(name?: string | null) {
  return (name ?? "Guest")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.map((group) => [group.label, true])),
  );
  const { session, logout, notifications, offices } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread = notifications.filter((n) => !n.read).length;
  const role = session?.role;
  const visibleGroups = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: role
          ? group.items.filter((item) => item.roles.includes(role))
          : group.items.filter((item) => item.to === "/track"),
      })).filter((group) => group.items.length > 0),
    [role],
  );
  const navItems = visibleGroups.flatMap((group) => group.items);
  const activeNavItem = [...navItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  const currentItem = activeNavItem;

  useEffect(() => {
    const activeGroup = visibleGroups.find((group) =>
      group.items.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)),
    );
    if (!activeGroup) return;
    setOpenGroups((groups) =>
      groups[activeGroup.label] ? groups : { ...groups, [activeGroup.label]: true },
    );
  }, [pathname, visibleGroups]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const signOut = async () => {
    await logout();
    navigate({ to: "/" });
  };

  const sidebar = (
    <div
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground",
        collapsed && "items-center",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <ScanLine className="size-[1.125rem]" aria-hidden />
        </span>
        <div className={cn("min-w-0", collapsed && "hidden")}>
          <p className="truncate text-sm font-semibold tracking-tight">LGU DocTrack</p>
          <p className="truncate text-[11px] text-sidebar-foreground/55">Document workspace</p>
        </div>
        <button
          className="ml-auto rounded-lg p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className={cn("w-full px-3 pb-3", collapsed && "px-2")}>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 text-left text-xs text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <Search className="size-3.5" />
          <span className={cn(collapsed && "hidden")}>Search workspace</span>
          <kbd
            className={cn(
              "ml-auto hidden rounded border border-sidebar-border px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/45 xl:inline",
              collapsed && "hidden",
            )}
          >
            Ctrl K
          </kbd>
        </button>
      </div>

      <nav className={cn("w-full flex-1 space-y-5 overflow-y-auto px-3 py-2", collapsed && "px-2")}>
        {visibleGroups.map((group) => {
          const groupOpen = collapsed || openGroups[group.label] !== false;

          return (
            <Collapsible
              key={group.label}
              open={groupOpen}
              onOpenChange={(nextOpen) => {
                if (!collapsed) {
                  setOpenGroups((groups) => ({ ...groups, [group.label]: nextOpen }));
                }
              }}
            >
              {collapsed ? null : (
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group flex w-full items-center justify-between rounded-md px-3 pb-2 text-left text-[10px] font-semibold tracking-[0.14em] text-sidebar-foreground/45 uppercase transition-colors hover:text-sidebar-foreground/75"
                    aria-label={`${groupOpen ? "Collapse" : "Expand"} ${group.label} menu`}
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        groupOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                </CollapsibleTrigger>
              )}
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = activeNavItem?.to === item.to;
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all",
                            collapsed && "justify-center px-2",
                            active
                              ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-sm"
                              : "text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                          aria-current={active ? "page" : undefined}
                          title={collapsed ? item.label : undefined}
                        >
                          <item.icon
                            className="size-4 shrink-0 opacity-75 transition-opacity group-hover:opacity-100"
                            aria-hidden
                          />
                          <span className={cn("truncate", collapsed && "hidden")}>
                            {item.label}
                          </span>
                          {item.to === "/notifications" && unread > 0 && !collapsed ? (
                            <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {unread}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      <div className={cn("mt-auto w-full border-t border-sidebar-border p-3", collapsed && "px-2")}>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            void signOut();
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/65 px-3 py-2.5 text-left text-xs font-medium text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent",
            collapsed && "justify-center px-2",
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="size-4" aria-hidden />
          <span className={cn(collapsed && "hidden")}>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen min-h-[100svh] overflow-x-hidden bg-background">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border transition-[width] duration-200 lg:block",
          collapsed ? "w-[4.25rem]" : "w-[17rem]",
        )}
      >
        <div
          className={cn(
            "fixed inset-y-0 border-r border-sidebar-border shadow-sm transition-[width] duration-200",
            collapsed ? "w-[4.25rem]" : "w-[17rem]",
          )}
        >
          {sidebar}
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,calc(100vw-1rem))] border-r border-sidebar-border shadow-2xl">
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-border/80 bg-background/85 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-xl sm:gap-3 sm:px-6 sm:py-0 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-[1.125rem]" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="hidden rounded-lg lg:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft className="size-4" />
          </Button>

          <div className="hidden min-w-0 items-center gap-2 text-sm md:flex">
            <span className="text-muted-foreground">Workspace</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="truncate font-medium text-foreground">
              {currentItem?.label ?? "Overview"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 w-44 justify-start gap-2 rounded-lg px-3 text-muted-foreground sm:inline-flex lg:w-52"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-3.5" />
              <span>Search</span>
              <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] font-medium">
                Ctrl K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg sm:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="size-[1.125rem]" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-lg px-2.5 sm:px-3"
              asChild
            >
              <Link to="/scanner" aria-label="Open scanner">
                <QrCode className="size-4" aria-hidden />
                <span className="hidden sm:inline">Scan</span>
              </Link>
            </Button>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-lg"
              asChild
              aria-label="Notifications"
            >
              <Link to="/notifications">
                <Bell className="size-[1.125rem]" />
                {unread > 0 ? (
                  <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
                ) : null}
              </Link>
            </Button>
            <div className="mx-0.5 hidden h-6 w-px bg-border sm:block" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 rounded-lg px-1.5 sm:px-2">
                  <Avatar className="size-7 border border-border">
                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                      {initials(session?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-28 truncate text-xs font-medium lg:inline">
                    {session?.name ?? "Guest"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium">{session?.name ?? "Guest"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {officeName(session?.officeId)}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" onSelect={() => void signOut()}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </div>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search pages and actions..." />
        <CommandList>
          <CommandEmpty>No matching pages found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {navItems.map((item) => (
              <CommandItem
                key={item.to}
                value={`${item.label} ${item.to} ${item.keywords}`}
                onSelect={() => {
                  setSearchOpen(false);
                  void navigate({ to: item.to });
                }}
              >
                <item.icon className="text-muted-foreground" />
                <span>{item.label}</span>
                {pathname === item.to ? <CommandShortcut>Current</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
          {role === "admin" ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Offices">
                {offices.map((office) => (
                  <CommandItem
                    key={office.id}
                    value={`${office.name} ${office.code} ${office.location} ${office.keywords}`}
                    onSelect={() => {
                      setSearchOpen(false);
                      void navigate({ to: "/offices" });
                    }}
                  >
                    <Building2 className="text-muted-foreground" />
                    <span>{office.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{office.code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
          <CommandSeparator />
          <CommandGroup heading="Quick actions">
            <CommandItem
              value="scan qr document"
              onSelect={() => {
                setSearchOpen(false);
                void navigate({ to: "/scanner" });
              }}
            >
              <QrCode className="text-muted-foreground" />
              <span>Open mobile scanner</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
