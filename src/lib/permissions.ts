import type { UserRole } from "@/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  office_head: "Office head",
  staff: "Staff",
  receiving: "Receiving clerk",
};

export const ROLE_PRIVILEGES: Record<UserRole, string> = {
  admin:
    "Full access to every menu, user management, system configuration, audit and reports; document actions remain limited to the administrator's assigned office.",
  office_head:
    "Monitor and act on documents assigned to their office, including receiving, processing, approving and dispatching.",
  staff: "Register, receive, process, forward and file documents assigned to their office.",
  receiving: "Scanner-focused access for receiving, dispatching and flagging wrong-office scans.",
};

export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/dashboard",
  office_head: "/office",
  staff: "/documents",
  receiving: "/scanner",
};

export const ALL_ROLES: UserRole[] = ["admin", "office_head", "staff", "receiving"];
