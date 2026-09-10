import type {
  AuditEntry,
  DocumentStatus,
  DocumentType,
  NotificationItem,
  Office,
  Priority,
  RoutingPurpose,
  TrackedDocument,
  User,
  UserRole,
} from "@/types";

function defaultApiBase() {
  if (typeof window === "undefined") return "http://localhost:3001/api";

  const { hostname, protocol } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

  // HTTPS production traffic must stay same-origin so it can use the HTTPS
  // reverse proxy for both the app and API. Direct HTTP API calls are blocked
  // as mixed content and also prevent secure session cookies from working.
  if (protocol === "https:") return `${window.location.origin}/api`;
  if (isLocalHost) return "http://localhost:3001/api";
  if (protocol === "http:") return `http://${hostname}:3001/api`;
  return `${window.location.origin}/api`;
}

const configuredApiBase = import.meta.env["VITE_API_BASE_URL"];
const browserHostname = typeof window === "undefined" ? "" : window.location.hostname;
const browserIsLocalHost = browserHostname === "localhost" || browserHostname === "127.0.0.1";
const configuredApiBaseIsLocalOnly =
  typeof window !== "undefined" &&
  !browserIsLocalHost &&
  (configuredApiBase?.includes("localhost") || configuredApiBase?.includes("127.0.0.1"));
const configuredApiBaseIsLanOnly =
  typeof window !== "undefined" &&
  browserIsLocalHost &&
  /^https?:\/\/(?:192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(configuredApiBase ?? "");
const configuredApiBaseIsMixedContent =
  typeof window !== "undefined" &&
  window.location.protocol === "https:" &&
  configuredApiBase?.startsWith("http:");
const API_BASE =
  configuredApiBase &&
  !configuredApiBase.includes("YOUR_LAN_IP") &&
  !configuredApiBaseIsLocalOnly &&
  !configuredApiBaseIsLanOnly &&
  !configuredApiBaseIsMixedContent
    ? configuredApiBase
    : defaultApiBase();

export interface AttachmentInput {
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface RegisterInput {
  requestId?: string;
  title: string;
  subject?: string;
  typeId: string;
  priority: Priority;
  requester?: string;
  pageCount?: number;
  remarks?: string | undefined;
  attachments?: AttachmentInput[] | undefined;
}

export interface AppBootstrap {
  documents: TrackedDocument[];
  notifications: NotificationItem[];
  offices: Office[];
  users: User[];
  documentTypes: DocumentType[];
}

export interface UserInput {
  name: string;
  username: string;
  password?: string | undefined;
  role: UserRole;
  officeId: string;
  position: string;
  active: boolean;
}

export interface OfficeInput {
  name: string;
  code: string;
  location: string;
  keywords: string;
  active: boolean;
}

export interface DocumentTypeInput {
  name: string;
  code?: string;
  active?: boolean;
}

export interface RoutingPurposeInput {
  name: string;
  active?: boolean;
}

export interface GeneralSettings {
  lguName: string;
  address: string;
}

export interface SlaSettings {
  routineHours: number;
  urgentHours: number;
  rushHours: number;
}

export interface NotificationSettings {
  overdueAlerts: boolean;
  wrongOfficeScans: boolean;
  dailyDigest: boolean;
}

export interface ScannerSettings {
  blockWrongOfficeReceipts: boolean;
  requireRemarksOnHold: boolean;
  vibrateOnSuccessfulScan: boolean;
}

export interface SystemSettings {
  general: GeneralSettings;
  sla: SlaSettings;
  notifications: NotificationSettings;
  scanner: ScannerSettings;
}

export type SavedSystemSettings = {
  [Key in keyof SystemSettings]?: Partial<SystemSettings[Key]>;
};

let officeCache: Office[] = [];
let userCache: User[] = [];
let typeCache: DocumentType[] = [];
let csrfToken: string | null = null;

async function loadCsrfToken() {
  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to establish a secure session.");
  const body = (await response.json()) as { csrfToken: string };
  csrfToken = body.csrfToken;
  return csrfToken;
}
export type RegisteredDocument = TrackedDocument & { publicTrackingToken?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init.body !== null;
  const mutation = ["POST", "PATCH", "DELETE"].includes(init?.method ?? "GET");
  const exempt = path === "/auth/login";
  if (mutation && !exempt && !csrfToken) await loadCsrfToken();
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(mutation && !exempt && csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const body = await response.text();
    let message = body || response.statusText;
    try {
      message = JSON.parse(body).message ?? message;
    } catch {
      /* Plain-text response. */
    }
    throw new Error(message);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return (await response.text()) as T;
  return (await response.json()) as T;
}

function rememberReferences(data: Partial<AppBootstrap>) {
  if (data.offices) officeCache = data.offices;
  if (data.users) userCache = data.users;
  if (data.documentTypes) typeCache = data.documentTypes;
}

export const api = {
  async login(username: string, password: string): Promise<User> {
    const result = await request<{ user: User; csrfToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    csrfToken = result.csrfToken;
    return result.user;
  },
  async logout(): Promise<void> {
    await request("/auth/logout", { method: "POST" });
    officeCache = [];
    userCache = [];
    typeCache = [];
    csrfToken = null;
  },
  async me(): Promise<User | null> {
    try {
      const result = await request<{ user: User }>("/auth/me");
      await loadCsrfToken();
      return result.user;
    } catch {
      return null;
    }
  },
  async bootstrap(role?: UserRole | null): Promise<AppBootstrap> {
    const [documents, notifications, offices, users, documentTypes] = await Promise.all([
      api.listDocuments(),
      api.listNotifications(),
      api.listOffices(),
      role === "admin" || !role ? api.listUsers() : Promise.resolve([]),
      api.listDocumentTypes(),
    ]);
    const data = { documents, notifications, offices, users, documentTypes };
    rememberReferences(data);
    return data;
  },
  async listOffices(): Promise<Office[]> {
    return request<Office[]>("/offices");
  },
  async createOffice(input: OfficeInput): Promise<Office> {
    return request<Office>("/offices", { method: "POST", body: JSON.stringify(input) });
  },
  async updateOffice(id: string, patch: Partial<OfficeInput>): Promise<Office> {
    return request<Office>(`/offices/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async deleteOffice(id: string): Promise<void> {
    await request(`/offices/${id}`, { method: "DELETE" });
  },
  async listUsers(): Promise<User[]> {
    return request<User[]>("/users");
  },
  async createUser(input: UserInput): Promise<User> {
    return request<User>("/users", { method: "POST", body: JSON.stringify(input) });
  },
  async updateUser(id: string, patch: Partial<UserInput>): Promise<User> {
    return request<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async deleteUser(id: string): Promise<void> {
    await request(`/users/${id}`, { method: "DELETE" });
  },
  async listDocuments(): Promise<TrackedDocument[]> {
    return request<TrackedDocument[]>("/documents");
  },
  async getDocument(id: string): Promise<TrackedDocument> {
    return request<TrackedDocument>(`/documents/${id}`);
  },
  async registerDocument(input: RegisterInput): Promise<RegisteredDocument> {
    return request<RegisteredDocument>("/documents", { method: "POST", body: JSON.stringify(input) });
  },
  async dispatchDocument(
    docId: string,
    toOfficeId: string,
    remarks?: string,
    expectedUpdatedAt?: string,
  ): Promise<TrackedDocument> {
    return request<TrackedDocument>(`/documents/${docId}/dispatch`, {
      method: "POST",
      body: JSON.stringify({ toOfficeId, remarks, expectedUpdatedAt }),
    });
  },
  async receiveDocument(
    docId: string,
    remarks?: string,
    expectedUpdatedAt?: string,
  ): Promise<TrackedDocument> {
    return request<TrackedDocument>(`/documents/${docId}/receive`, {
      method: "POST",
      body: JSON.stringify({ remarks, expectedUpdatedAt }),
    });
  },
  async setStatus(
    docId: string,
    status: DocumentStatus,
    remarks?: string,
    expectedUpdatedAt?: string,
  ): Promise<TrackedDocument> {
    return request<TrackedDocument>(`/documents/${docId}/status`, {
      method: "POST",
      body: JSON.stringify({ status, remarks, expectedUpdatedAt }),
    });
  },
  async voidDocument(
    docId: string,
    reason: string,
    expectedUpdatedAt?: string,
  ): Promise<TrackedDocument> {
    return request<TrackedDocument>(`/documents/${docId}/void`, {
      method: "POST",
      body: JSON.stringify({ reason, expectedUpdatedAt }),
    });
  },
  async fileDocument(
    docId: string,
    location: string,
    expectedUpdatedAt?: string,
  ): Promise<TrackedDocument> {
    return request<TrackedDocument>(`/documents/${docId}/file`, {
      method: "POST",
      body: JSON.stringify({ location, expectedUpdatedAt }),
    });
  },
  async flagWrongOffice(docId: string, scannedOfficeId: string): Promise<TrackedDocument> {
    return request<TrackedDocument>(`/documents/${docId}/wrong-office`, {
      method: "POST",
      body: JSON.stringify({ scannedOfficeId }),
    });
  },
  async resolveScan(code: string): Promise<{
    outcome: "receive" | "dispatch" | "wrong_office" | "unknown" | "unavailable";
    doc?: TrackedDocument;
  }> {
    return request(`/scans/resolve?code=${encodeURIComponent(code)}`);
  },
  async publicTrack(token: string): Promise<{
    trackingReference: string;
    status: "active" | "in_transit" | "completed" | "unavailable";
    updatedAt: string;
  }> {
    return request(`/public/track?token=${encodeURIComponent(token)}`);
  },
  async rotatePublicToken(docId: string): Promise<string> {
    const result = await request<{ token: string }>(`/documents/${docId}/public-token/rotate`, { method: "POST" });
    return result.token;
  },
  async revokePublicToken(docId: string): Promise<void> {
    await request(`/documents/${docId}/public-token/revoke`, { method: "POST" });
  },
  async listDocumentTypes(): Promise<DocumentType[]> {
    return request<DocumentType[]>("/document-types");
  },
  async createDocumentType(input: DocumentTypeInput): Promise<DocumentType> {
    return request<DocumentType>("/document-types", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async updateDocumentType(id: string, patch: Partial<DocumentTypeInput>): Promise<DocumentType> {
    return request<DocumentType>(`/document-types/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  async deleteDocumentType(id: string): Promise<void> {
    await request(`/document-types/${id}`, { method: "DELETE" });
  },
  async listRoutingPurposes(): Promise<RoutingPurpose[]> {
    return request<RoutingPurpose[]>("/routing-purposes");
  },
  async createRoutingPurpose(input: RoutingPurposeInput): Promise<RoutingPurpose> {
    return request<RoutingPurpose>("/routing-purposes", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async listNotifications(): Promise<NotificationItem[]> {
    return request<NotificationItem[]>("/notifications");
  },
  async toggleNotification(id: string, read: boolean): Promise<NotificationItem> {
    return request<NotificationItem>(`/notifications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ read }),
    });
  },
  async markAllNotificationsRead(): Promise<void> {
    await request("/notifications/read-all", { method: "POST" });
  },
  async listAudit(): Promise<AuditEntry[]> {
    return request<AuditEntry[]>("/audit");
  },
  async getSettings(): Promise<SavedSystemSettings> {
    return request<SavedSystemSettings>("/settings");
  },
  async analytics() {
    return request("/analytics");
  },
  async updateSettings(
    key: string,
    value: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return request(`/settings/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify(value),
    });
  },
  reportUrl(template: string, format = "csv", officeId = "all", from = "", to = "") {
    const office = officeId === "all" ? "" : `&officeId=${encodeURIComponent(officeId)}`;
    return `${API_BASE}/reports/${template}?format=${format}${office}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`;
  },
  routingSlipUrl(docId: string) {
    return `${API_BASE}/documents/${docId}/slip`;
  },
  attachmentUrl(docId: string, attachmentId: string) {
    return `${API_BASE}/documents/${docId}/attachments/${attachmentId}`;
  },
};

export const officeById = (id?: string) => officeCache.find((o) => o.id === id);
export const officeName = (id?: string) => officeById(id)?.name ?? "-";
export const officeCode = (id?: string) => officeById(id)?.code ?? "-";
export const userById = (id?: string) => userCache.find((u) => u.id === id);
export const userName = (id?: string) => userById(id)?.name ?? "System";
export const docTypeById = (id?: string) => typeCache.find((t) => t.id === id);
export const docTypeName = (id?: string) => docTypeById(id)?.name ?? "-";
