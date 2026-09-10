// Domain types for the LGU QR Document Tracking System.
// Frontend-only prototype: these mirror the shape a future
// Node.js + MySQL API is expected to return.

export type UserRole = "admin" | "office_head" | "staff" | "receiving";

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  officeId: string;
  position: string;
  active: boolean;
  lastLogin: string;
  avatarInitials: string;
}

export interface Office {
  id: string;
  code: string;
  name: string;
  location: string;
  keywords: string;
  active: boolean;
  staffCount: number;
}

export type DocumentStatus =
  | "registered"
  | "in_transit"
  | "received"
  | "in_process"
  | "on_hold"
  | "returned"
  | "completed"
  | "filed"
  | "voided";

export type Priority = "routine" | "urgent" | "rush";

export interface DocumentType {
  id: string;
  name: string;
  code: string;
  active?: boolean;
}

export interface RoutingPurpose {
  id: string;
  name: string;
  active?: boolean;
}

export interface TrackingEvent {
  id: string;
  documentId: string;
  action:
    | "registered"
    | "dispatched"
    | "received"
    | "processed"
    | "held"
    | "returned"
    | "completed"
    | "filed"
    | "wrong_office"
    | "voided";
  fromOfficeId?: string | undefined;
  toOfficeId?: string | undefined;
  actorId: string;
  actorName?: string | undefined;
  remarks?: string | undefined;
  timestamp: string;
}

export interface DocumentAttachment {
  id: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
}

export interface TrackedDocument {
  id: string;
  trackingCode: string;
  qrCode: string;
  title: string;
  typeId: string;
  typeName?: string;
  typeCode?: string;
  status: DocumentStatus;
  priority: Priority;
  originOfficeId: string;
  currentOfficeId: string;
  nextOfficeId?: string | undefined;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  remarks?: string | undefined;
  subject: string;
  requester: string;
  pageCount: number;
  fileLocation?: string | undefined;
  attachments: DocumentAttachment[];
  events: TrackingEvent[];
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  kind: "info" | "warning" | "success" | "danger";
  read: boolean;
  timestamp: string;
  documentId?: string | undefined;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  target: string;
  ip: string;
  timestamp: string;
  severity: "low" | "medium" | "high";
}

export interface Session {
  user: User;
  loggedInAt: string;
}

export type ScanOutcome = "receive" | "dispatch" | "wrong_office" | "unknown" | "unavailable";
