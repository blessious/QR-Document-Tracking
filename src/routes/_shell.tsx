import { useApp } from "@/store/app-store";
import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingPageSkeleton } from "@/components/common/LoadingPageSkeleton";
import { LoginPage } from "./index";

export const Route = createFileRoute("/_shell")({
  component: ShellLayout,
});

function ShellLayout() {
  const { session, loading } = useApp();
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (loading) return <LoadingPageSkeleton />;
  if (!session && path !== "/track") return <LoginPage />;
  const adminOnly = ["/dashboard", "/users", "/offices", "/settings", "/audit"].some(
    (prefix) => path === prefix || path.startsWith(prefix + "/"),
  );
  const managementOnly = ["/analytics", "/reports"].includes(path);
  if (
    session &&
    ((adminOnly && session.role !== "admin") ||
      (managementOnly && !["admin", "office_head"].includes(session.role)) ||
      (path === "/references" && !["admin", "office_head", "staff"].includes(session.role)) ||
      (path === "/documents/new" && session.role === "receiving"))
  )
    return <p className="p-6">Your role does not have access to this page.</p>;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
