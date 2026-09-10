import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type RegisterInput, type RegisteredDocument } from "@/services/api";
import type {
  DocumentStatus,
  DocumentType,
  NotificationItem,
  Office,
  TrackedDocument,
  User,
} from "@/types";

interface AppState {
  session: User | null;
  loading: boolean;
  apiOnline: boolean;
  documents: TrackedDocument[];
  notifications: NotificationItem[];
  offices: Office[];
  users: User[];
  documentTypes: DocumentType[];
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  registerDocument: (input: RegisterInput) => Promise<RegisteredDocument>;
  receiveDocument: (docId: string, remarks?: string, expectedUpdatedAt?: string) => Promise<void>;
  dispatchDocument: (
    docId: string,
    toOfficeId: string,
    remarks?: string,
    expectedUpdatedAt?: string,
  ) => Promise<void>;
  flagWrongOffice: (docId: string, scannedOfficeId: string) => Promise<void>;
  setStatus: (docId: string, status: DocumentStatus, remarks?: string) => Promise<void>;
  voidDocument: (docId: string, reason: string) => Promise<void>;
  fileDocument: (docId: string, location: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  toggleRead: (id: string) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

function replaceDocument(list: TrackedDocument[], document: TrackedDocument) {
  return list.some((d) => d.id === document.id)
    ? list.map((d) => (d.id === document.id ? document : d))
    : [document, ...list];
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(true);
  const [documents, setDocuments] = useState<TrackedDocument[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);

  const refreshEpoch = useRef(0);
  const refresh = useCallback(
    async (role = session?.role) => {
      const epoch = ++refreshEpoch.current;
      try {
        const data = await api.bootstrap(role);
        if (epoch !== refreshEpoch.current) return;
        setDocuments(data.documents);
        setNotifications(data.notifications);
        setOffices(data.offices);
        if (!role || role === "admin") setUsers(data.users);
        setDocumentTypes(data.documentTypes);
        setApiOnline(true);
      } catch (error) {
        if (epoch !== refreshEpoch.current) return;
        console.warn("Could not refresh from API.", error);
        setApiOnline(false);
      }
    },
    [session?.role],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const current = await api.me();
        if (!cancelled) setSession(current);
        if (current) await refresh(current.role);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!session) return;
    const update = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(update, 10000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
    };
  }, [session, refresh]);

  const value = useMemo<AppState>(
    () => ({
      session,
      loading,
      apiOnline,
      documents,
      notifications,
      offices,
      users,
      documentTypes,
      login: async (username, password) => {
        const user = await api.login(username, password);
        setSession(user);
        await refresh(user.role);
        return user;
      },
      logout: async () => {
        await api.logout();
        refreshEpoch.current++;
        setSession(null);
        setDocuments([]);
        setNotifications([]);
        setUsers([]);
      },
      refresh,
      registerDocument: async (input) => {
        const document = await api.registerDocument(input);
        setDocuments((prev) => replaceDocument(prev, document));
        await refresh();
        return document;
      },
      receiveDocument: async (docId, remarks, expectedUpdatedAt) => {
        const document = await api.receiveDocument(
          docId,
          remarks,
          expectedUpdatedAt ?? documents.find((d) => d.id === docId)?.updatedAt,
        );
        setDocuments((prev) => replaceDocument(prev, document));
        await refresh();
      },
      dispatchDocument: async (docId, toOfficeId, remarks, expectedUpdatedAt) => {
        const document = await api.dispatchDocument(
          docId,
          toOfficeId,
          remarks,
          expectedUpdatedAt ?? documents.find((d) => d.id === docId)?.updatedAt,
        );
        setDocuments((prev) => replaceDocument(prev, document));
        await refresh();
      },
      flagWrongOffice: async (docId, scannedOfficeId) => {
        const document = await api.flagWrongOffice(docId, scannedOfficeId);
        setDocuments((prev) => replaceDocument(prev, document));
        await refresh();
      },
      setStatus: async (docId, status, remarks) => {
        const document = await api.setStatus(
          docId,
          status,
          remarks,
          documents.find((d) => d.id === docId)?.updatedAt,
        );
        setDocuments((prev) => replaceDocument(prev, document));
        await refresh();
      },
      voidDocument: async (docId, reason) => {
        const document = await api.voidDocument(
          docId,
          reason,
          documents.find((d) => d.id === docId)?.updatedAt,
        );
        setDocuments((prev) => replaceDocument(prev, document));
        await refresh();
      },
      fileDocument: async (docId, location) => {
        const document = await api.fileDocument(
          docId,
          location,
          documents.find((d) => d.id === docId)?.updatedAt,
        );
        setDocuments((prev) => replaceDocument(prev, document));
        await refresh();
      },
      markAllRead: async () => {
        await api.markAllNotificationsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      },
      toggleRead: async (id) => {
        const current = notifications.find((n) => n.id === id);
        if (!current) return;
        const updated = await api.toggleNotification(id, !current.read);
        setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
      },
    }),
    [apiOnline, documents, documentTypes, loading, notifications, offices, refresh, session, users],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppStoreProvider");
  return ctx;
}

export function useRequireRole(roles: User["role"][]) {
  const { session } = useApp();
  return Boolean(session && roles.includes(session.role));
}
