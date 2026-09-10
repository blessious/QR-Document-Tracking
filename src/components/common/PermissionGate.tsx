import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingPageSkeleton } from "@/components/common/LoadingPageSkeleton";
import { useApp } from "@/store/app-store";
import type { UserRole } from "@/types";
import { LoginPage } from "@/routes";

export function PermissionGate({
  roles,
  children,
}: {
  roles: UserRole[];
  children: React.ReactNode;
}) {
  const { session, loading } = useApp();

  if (loading) {
    return <LoadingPageSkeleton variant="content" />;
  }

  if (!session) {
    return <LoginPage />;
  }

  if (!roles.includes(session.role)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Access restricted"
        description="Your account does not have permission to open this workspace area."
      />
    );
  }

  return children;
}
